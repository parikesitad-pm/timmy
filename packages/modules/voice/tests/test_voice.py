import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import numpy as np
import aiohttp
from aiohttp import web

from timmy_voice_windows.audio import BLOCK, Microphone, Speaker, chime_samples, wake_command
from timmy_voice_windows.runtime import Voice
from timmy_voice_windows.settings import settings


class ConfigurationTests(unittest.TestCase):
    def test_wake_chime_uses_real_audio_output_and_stays_within_pcm_range(self):
        audio = chime_samples()
        self.assertEqual(audio.dtype, np.float32)
        self.assertGreater(len(audio), 3000)
        self.assertLessEqual(float(np.abs(audio).max()), 0.25)

    def test_wake_fallback_accepts_jarvis_variants_and_keeps_an_inline_command(self):
        self.assertEqual(wake_command("Hi Jarvis."), "")
        self.assertEqual(wake_command("Hey Jarvis, tell me you're alive"), "tell me you're alive")
        self.assertEqual(wake_command("Hai Jarvis!"), "")
        self.assertIsNone(wake_command("We talked about Jarvis yesterday"))
        self.assertIsNone(wake_command("Hi Vesper"))

    def test_selected_profile_and_explicit_auth_remain_private(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "config.yaml").write_text(
                'server: {port: 4444, auth: {token: test-token}}\n'
                'assistant: {language: {conversation: id}}\n', encoding="utf-8",
            )
            with patch.dict("os.environ", {"TIMMY_HOME": directory}):
                config = settings()
            self.assertEqual(config["url"], "http://127.0.0.1:4444")
            self.assertEqual(config["language"], "id")
            self.assertEqual(config["wake"], "hey_jarvis")
            voice = Voice(config)
            voice.state("asleep")
            status = json.loads(Path(directory, "voice", "status.json").read_text())
            self.assertNotIn("token", status)


class MicrophoneTests(unittest.IsolatedAsyncioTestCase):
    async def test_idle_timeout_does_not_send_silence_to_recognition(self):
        with patch("timmy_voice_windows.audio.sd.RawInputStream"):
            mic = Microphone()
        mic.read = AsyncMock(return_value=np.zeros(BLOCK, dtype=np.int16))
        audio = await mic.record({"first_listen": 0.2, "silence": 0.2})
        self.assertEqual(audio.size, 0)

    async def test_speech_ends_after_trailing_silence_and_normalizes_samples(self):
        with patch("timmy_voice_windows.audio.sd.RawInputStream"):
            mic = Microphone()
        mic.read = AsyncMock(return_value=np.full(BLOCK, 1000, dtype=np.int16))
        speech = np.full(BLOCK * 4, 1000 / 32768, dtype=np.float32)
        with patch("timmy_voice_windows.audio.speech_clip", return_value=(speech, True)):
            audio = await mic.record({"first_listen": 1, "silence": 0.15})
        self.assertEqual(audio.size, BLOCK * 4)
        self.assertEqual(audio.dtype, np.float32)
        self.assertGreater(float(audio.max()), 0)
        self.assertLess(float(audio.max()), 1)

    async def test_a_non_speech_cue_does_not_finish_capture_before_the_command(self):
        with patch("timmy_voice_windows.audio.sd.RawInputStream"):
            mic = Microphone()
        mic.read = AsyncMock(return_value=np.ones(BLOCK, dtype=np.int16))
        speech = np.full(BLOCK, 0.1, dtype=np.float32)
        with patch("timmy_voice_windows.audio.speech_clip", side_effect=[(None, False), (speech, True)]):
            captured = await mic.record({"first_listen": 1, "silence": 0.3})
        self.assertEqual(mic.read.await_count, 8)
        np.testing.assert_array_equal(captured, speech)

    async def test_muting_drops_queued_audio_and_backlog_stays_bounded(self):
        with patch("timmy_voice_windows.audio.sd.RawInputStream"):
            mic = Microphone()
        for _ in range(100):
            mic._enqueue(b"sample")
        self.assertEqual(mic.queue.qsize(), 64)
        self.assertEqual(mic.overflows, 36)
        mic.listening(False)
        mic._enqueue(b"speaker echo")
        self.assertTrue(mic.queue.empty())

    async def test_stopping_speech_waits_for_its_child_process(self):
        speaker = Speaker({})
        child = AsyncMock()
        child.returncode = None
        child.terminate = unittest.mock.Mock()
        speaker.process = child
        await speaker.stop()
        child.terminate.assert_called_once()
        child.wait.assert_awaited_once()
        self.assertIsNone(speaker.process)


class LifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_authenticated_stop_cancels_listening_and_releases_resources(self):
        async def health(_request):
            return web.json_response({"ok": True})

        async def listening(*_args):
            await asyncio.Event().wait()

        app = web.Application()
        app.router.add_get("/health", health)
        core = web.AppRunner(app)
        await core.setup()
        await web.TCPSite(core, "127.0.0.1", 0).start()
        task = None
        with tempfile.TemporaryDirectory() as directory:
            config = {"home": Path(directory), "url": f"http://127.0.0.1:{core.addresses[0][1]}"}
            voice = Voice(config)
            voice.speaker = AsyncMock()
            voice.conversation = listening
            mic = unittest.mock.Mock()
            try:
                with patch("timmy_voice_windows.runtime.wake_model"), patch("timmy_voice_windows.runtime.whisper_model"), patch("timmy_voice_windows.runtime.Microphone", return_value=mic):
                    task = asyncio.create_task(voice.run())
                    record = Path(directory, "voice", "control.json")
                    async with asyncio.timeout(5):
                        while not record.exists():
                            await asyncio.sleep(0.01)
                    control = json.loads(record.read_text())
                    url = f"http://127.0.0.1:{control['port']}"
                    async with aiohttp.ClientSession() as session:
                        async with session.post(url + "/stop") as response:
                            self.assertEqual(response.status, 401)
                        async with session.post(url + "/stop", headers={"Authorization": "Bearer " + control["token"]}) as response:
                            self.assertEqual(response.status, 200)
                    await asyncio.wait_for(task, timeout=5)
                    self.assertFalse(record.exists())
                    self.assertEqual(voice.stats["state"], "stopped")
                    mic.close.assert_called_once()
                    voice.speaker.stop.assert_awaited_once()
            finally:
                if task and not task.done():
                    task.cancel()
                await core.cleanup()


if __name__ == "__main__":
    unittest.main()
