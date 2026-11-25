"""Local capture/inference and Windows SAPI. No raw audio is saved by default."""
import asyncio
import contextlib
import hashlib
import os
import re
import tempfile
import wave
from pathlib import Path

import numpy as np
import requests
import sounddevice as sd

RATE = 16000
BLOCK = 1280
MODEL_URL = "https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/"


def chime_samples():
    length = int(RATE * 0.11)
    fade = np.minimum(np.arange(length) / 128, np.arange(length)[::-1] / 128).clip(0, 1)
    tones = [0.25 * fade * np.sin(2 * np.pi * frequency * np.arange(length) / RATE) for frequency in (880, 1175)]
    audio = np.concatenate([tones[0], np.zeros(int(RATE * 0.04)), tones[1]]).astype(np.float32)
    return audio


def wake_model(cfg):
    from openwakeword.model import Model

    directory = cfg["home"] / "voice" / "models" / "wake"
    directory.mkdir(parents=True, exist_ok=True)
    for name in ("melspectrogram.onnx", "embedding_model.onnx", "hey_jarvis_v0.1.onnx"):
        target = directory / name
        if target.exists():
            continue
        print(f"Downloading wake model: {name}", flush=True)
        temporary = target.with_suffix(".download")
        try:
            with requests.get(MODEL_URL + name, stream=True, timeout=(15, 60)) as response:
                response.raise_for_status()
                with temporary.open("wb") as output:
                    for chunk in response.iter_content(1024 * 1024):
                        output.write(chunk)
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    if cfg["wake"] != "hey_jarvis":
        raise ValueError("This Windows backend currently supports the pretrained hey_jarvis model")
    return Model(
        wakeword_models=[str(directory / "hey_jarvis_v0.1.onnx")],
        inference_framework="onnx",
        melspec_model_path=str(directory / "melspectrogram.onnx"),
        embedding_model_path=str(directory / "embedding_model.onnx"),
        ncpu=1,
    )


def whisper_model(cfg):
    from faster_whisper import WhisperModel

    return WhisperModel(
        cfg["model"], device="cpu", compute_type="int8", cpu_threads=min(4, os.cpu_count() or 1),
        download_root=str(cfg["home"] / "voice" / "models" / "whisper"),
    )


def transcribe(model, audio, language=None):
    segments, _ = model.transcribe(
        audio, language=language, beam_size=1, vad_filter=True,
        condition_on_previous_text=False, temperature=0,
    )
    return " ".join(segment.text.strip() for segment in segments).strip()


def wake_command(text):
    match = re.match(r"^\s*(?:hey|hi|hai|hello)[,\s]+jarvis\b[,\s.!?]*", text, flags=re.IGNORECASE)
    return text[match.end():].strip() if match else None


def speech_clip(frames, silence=0.3):
    from faster_whisper.vad import get_speech_timestamps

    audio = np.concatenate(frames).astype(np.float32) / 32768
    if len(audio) < RATE // 2 or float(np.max(np.abs(audio))) < 0.005:
        return None, False
    speech = get_speech_timestamps(audio, min_speech_duration_ms=160, min_silence_duration_ms=round(silence * 1000), speech_pad_ms=100)
    if not speech or speech[-1]["end"] > len(audio) - RATE // 5:
        return None, bool(speech)
    return audio[max(0, speech[0]["start"] - RATE // 5):speech[-1]["end"]], True


def ended_speech(frames):
    return speech_clip(frames)[0]


class Microphone:
    def __init__(self):
        self.queue = asyncio.Queue(maxsize=64)
        self.active = True
        self.loop = asyncio.get_running_loop()
        self.overflows = 0
        self.stream = sd.RawInputStream(
            samplerate=RATE, channels=1, dtype="int16", blocksize=BLOCK, callback=self._capture,
        )

    def _capture(self, data, _frames, _time, status):
        if status:
            self.overflows += 1
        if self.active:
            self.loop.call_soon_threadsafe(self._enqueue, bytes(data))

    def _enqueue(self, data):
        if self.active:
            if self.queue.full():
                self.queue.get_nowait()
                self.overflows += 1
            self.queue.put_nowait(data)

    def listening(self, active):
        self.active = active
        while not self.queue.empty():
            self.queue.get_nowait()

    async def read(self):
        return np.frombuffer(await self.queue.get(), dtype=np.int16)

    async def record(self, cfg):
        chunks = []
        started = False
        elapsed = 0
        while elapsed < 25:
            frame = await self.read()
            chunks.append(frame)
            elapsed += BLOCK / RATE
            if len(chunks) % 4 == 0:
                candidate, speech = await asyncio.to_thread(speech_clip, chunks.copy(), cfg["silence"])
                started |= speech
                if candidate is not None:
                    return candidate
            if not started and elapsed >= cfg["first_listen"]:
                return np.empty(0, dtype=np.float32)
        return np.concatenate(chunks).astype(np.float32) / 32768 if started else np.empty(0, dtype=np.float32)

    def close(self):
        self.active = False
        self.stream.stop()
        self.stream.close()


class Speaker:
    def __init__(self, cfg):
        self.cfg = cfg
        self.process = None

    async def chime(self):
        with tempfile.TemporaryDirectory(prefix="timmy-wake-cue-") as directory:
            path = Path(directory) / "cue.wav"
            with wave.open(str(path), "wb") as cue:
                cue.setnchannels(1)
                cue.setsampwidth(2)
                cue.setframerate(RATE)
                cue.writeframes((chime_samples() * 32767).astype(np.int16).tobytes())
            await self.speak("", audio=path)

    async def speak(self, text, *, output=None, audio=None):
        if not text.strip() and not audio:
            return
        executable = str(Path(os.environ.get("SystemRoot", r"C:\Windows")) /
                         "System32/WindowsPowerShell/v1.0/powershell.exe")
        script = (
            "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Speech; "
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "try { $j=[Console]::In.ReadToEnd() | ConvertFrom-Json; "
            "if($j.voice){$s.SelectVoice($j.voice)}; $s.Rate=$j.rate; "
            "if($j.output){$s.SetOutputToWaveFile($j.output)}; "
            "if($j.audio){$p=New-Object System.Speech.Synthesis.PromptBuilder; $p.AppendAudio($j.audio); $s.Speak($p)} "
            "else{$s.Speak($j.text)} } "
            "finally { $s.Dispose() }"
        )
        import json
        import subprocess

        process = await asyncio.create_subprocess_exec(
            executable, "-NoProfile", "-NonInteractive", "-Command", script,
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW,
        )
        self.process = process
        try:
            async with asyncio.timeout(60):
                await process.communicate(json.dumps({
                    "text": text, "voice": self.cfg["voice"], "rate": max(-10, min(10, round((self.cfg["rate"] - 1) * 5))),
                    "output": str(output) if output else None,
                    "audio": str(audio) if audio else None,
                }).encode("utf-8"))
            if process.returncode:
                raise RuntimeError(f"Windows speech output failed (exit {process.returncode})")
        finally:
            await self.stop()

    async def stop(self):
        process = self.process
        self.process = None
        if process and process.returncode is None:
            with contextlib.suppress(ProcessLookupError):
                process.terminate()
            await process.wait()


def model_fingerprints(cfg):
    directory = cfg["home"] / "voice" / "models" / "wake"
    return {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in directory.glob("*.onnx")}
