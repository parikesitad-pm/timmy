"""Hands-free half-duplex loop and authenticated local lifecycle control."""
import asyncio
import contextlib
import hmac
import json
import os
import secrets
import signal
import time
from collections import deque

import aiohttp
import numpy as np
from aiohttp import web

from .audio import Microphone, Speaker, ended_speech, transcribe, wake_command, wake_model, whisper_model


class Voice:
    def __init__(self, cfg):
        self.cfg = cfg
        self.directory = cfg["home"] / "voice"
        self.directory.mkdir(parents=True, exist_ok=True)
        self.stop = asyncio.Event()
        self.speaker = Speaker(cfg)
        self.thread = None
        self.stats = {"pid": os.getpid(), "wake_detections": 0, "completed_turns": 0}

    def state(self, name, *, quiet=False, **details):
        self.stats.update(state=name, updated_at=time.time(), **details)
        temporary = self.directory / "status.tmp"
        temporary.write_text(json.dumps(self.stats), encoding="utf-8")
        temporary.replace(self.directory / "status.json")
        if not quiet:
            print(f"voice: {name}", flush=True)

    async def request(self, session, text):
        body = {"message": text, "channel": "voice"}
        if self.thread:
            body["thread_id"] = self.thread
        headers = {"Authorization": f"Bearer {self.cfg['token']}"} if self.cfg["token"] else {}
        parts = []
        async with session.post(self.cfg["url"] + "/chat", json=body, headers=headers) as response:
            response.raise_for_status()
            async for line in response.content:
                frame = json.loads(line)
                if "thread_id" in frame:
                    self.thread = frame["thread_id"]
                if frame.get("type") == "content":
                    parts.append(frame.get("content", ""))
                if frame.get("type") == "error":
                    raise RuntimeError("The configured provider could not complete this voice turn")
                if frame.get("type") == "confirm_required":
                    await self.speaker.speak("Please confirm this action in the terminal.")
                    raise RuntimeError("Voice turn requires terminal confirmation")
        return "".join(parts).strip()

    async def conversation(self, mic, wake, whisper, session):
        observed = time.monotonic()
        peak = 0
        maximum_score = 0.0
        frames = 0
        while not self.stop.is_set():
            mic.listening(True)
            wake.reset()
            pending = deque(maxlen=50)
            initial_text = None
            method = "neural"
            self.state("asleep")
            while not self.stop.is_set():
                frame = await mic.read()
                score = max(wake.predict(frame).values(), default=0.0)
                rms = float(np.sqrt(np.mean(frame.astype(np.float32) ** 2)))
                peak = max(peak, int(np.max(np.abs(frame.astype(np.int32)))))
                maximum_score = max(maximum_score, float(score))
                frames += 1
                pending.append(frame)
                if time.monotonic() - observed >= 2:
                    self.state("asleep", quiet=True, audio_peak=peak, audio_rms=round(rms), wake_score=round(maximum_score, 4), audio_frames=frames)
                    observed, peak, maximum_score = time.monotonic(), 0, 0.0
                if score >= 0.5:
                    break
                if frames % 8 == 0:
                    candidate = await asyncio.to_thread(ended_speech, list(pending))
                    if candidate is not None:
                        mic.listening(False)
                        self.stats["wake_checks"] = self.stats.get("wake_checks", 0) + 1
                        self.state("checking-wake", quiet=True)
                        phrase = await asyncio.to_thread(transcribe, whisper, candidate, "en")
                        initial_text = wake_command(phrase)
                        if initial_text is not None:
                            method = "speech"
                            break
                        pending.clear()
                        wake.reset()
                        mic.listening(True)
                        self.state("asleep", quiet=True)
            self.stats["wake_detections"] += 1
            self.state("listening", wake_method=method)
            mic.listening(False)
            await self.speaker.chime()
            mic.listening(True)
            audio = await mic.record(self.cfg) if not initial_text else None
            mic.listening(False)
            if not initial_text and not audio.size:
                self.state("no-command")
                await self.speaker.speak("I didn't hear a command. Say Hey Jarvis and try again.")
                continue
            try:
                self.state("transcribing")
                text = initial_text or await asyncio.to_thread(transcribe, whisper, audio, self.cfg["language"])
                if not text:
                    self.state("unrecognized-command")
                    await self.speaker.speak("I didn't catch that. Please try again.")
                    continue
                self.state("thinking")
                reply = await self.request(session, text)
                if not reply:
                    raise RuntimeError("The provider returned no spoken reply")
                self.state("speaking")
                await self.speaker.speak(reply)
                self.stats["completed_turns"] += 1
            except (aiohttp.ClientError, RuntimeError) as error:
                self.state("turn-error", error=type(error).__name__)
                await self.speaker.speak("I couldn't finish that. Please try again.")

    async def run(self):
        self.state("loading-models")
        wake = await asyncio.to_thread(wake_model, self.cfg)
        whisper = await asyncio.to_thread(whisper_model, self.cfg)
        mic = Microphone()
        runner = None
        worker = None
        token = secrets.token_hex(32)
        record = self.directory / "control.json"

        async def control(request):
            if not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + token):
                raise web.HTTPUnauthorized()
            if request.method == "POST":
                self.stop.set()
            return web.json_response({"ok": True, "pid": os.getpid(), "state": self.stats["state"]})

        loop = asyncio.get_running_loop()
        handlers = {name: signal.getsignal(name) for name in (signal.SIGINT, signal.SIGTERM)}
        signal.signal(signal.SIGINT, lambda *_: loop.call_soon_threadsafe(self.stop.set))
        signal.signal(signal.SIGTERM, lambda *_: loop.call_soon_threadsafe(self.stop.set))
        timeout = aiohttp.ClientTimeout(total=180, connect=10)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(self.cfg["url"] + "/health") as response:
                    response.raise_for_status()
                mic.stream.start()
                mic.listening(False)
                await self.speaker.speak("Timmy is ready. Say Hey Jarvis, wait for the beep, then speak.")
                app = web.Application()
                app.router.add_get("/health", control)
                app.router.add_post("/stop", control)
                runner = web.AppRunner(app)
                await runner.setup()
                site = web.TCPSite(runner, "127.0.0.1", 0)
                await site.start()
                port = runner.addresses[0][1]
                self.state("asleep")
                record.write_text(json.dumps({"pid": os.getpid(), "port": port, "token": token}), encoding="utf-8")
                worker = asyncio.create_task(self.conversation(mic, wake, whisper, session))
                stopped = asyncio.create_task(self.stop.wait())
                done, _ = await asyncio.wait([worker, stopped], return_when=asyncio.FIRST_COMPLETED)
                stopped.cancel()
                if worker in done:
                    await worker
        finally:
            if worker:
                worker.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await worker
            mic.close()
            await self.speaker.stop()
            if runner:
                await runner.cleanup()
            record.unlink(missing_ok=True)
            self.state("stopped")
            for name, handler in handlers.items():
                signal.signal(name, handler)
