"""Exercise real local engines with synthetic speech; never save microphone audio."""
import asyncio
import json
import math
import tempfile
import wave
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from scipy.signal import resample_poly

from .audio import BLOCK, RATE, Microphone, Speaker, chime_samples, ended_speech, model_fingerprints, transcribe, wake_command, wake_model, whisper_model


def read_wave(path):
    with wave.open(str(path), "rb") as source:
        if source.getsampwidth() != 2:
            raise ValueError("Expected PCM16 synthetic speech")
        audio = np.frombuffer(source.readframes(source.getnframes()), dtype=np.int16)
        if source.getnchannels() > 1:
            audio = audio.reshape(-1, source.getnchannels()).mean(axis=1)
        rate = source.getframerate()
    divisor = math.gcd(rate, RATE)
    return resample_poly(audio.astype(np.float32) / 32768, RATE // divisor, rate // divisor)


async def probe(cfg, *, speak=False, capture=False):
    wake = await asyncio.to_thread(wake_model, cfg)
    whisper = await asyncio.to_thread(whisper_model, cfg)
    speaker = Speaker(cfg)
    results = {"wake_sha256": model_fingerprints(cfg), "inference": "cpu/int8"}
    with tempfile.TemporaryDirectory(prefix="timmy-synthetic-voice-") as directory:
        speech = Path(directory) / "speech.wav"
        await speaker.speak("This is a Windows voice test.", output=speech)
        audio = read_wave(speech)
        text = await asyncio.to_thread(transcribe, whisper, audio, "en")
        if "windows" not in text.lower() or "test" not in text.lower():
            raise AssertionError(f"Synthetic STT did not recognize the test sentence: {text}")
        results["synthetic_stt"] = "pass"
        sequence = np.concatenate([chime_samples(), np.zeros(RATE), audio, np.zeros(RATE * 2)])
        sequence = (np.clip(sequence, -1, 1) * 32767).astype(np.int16)
        sequence = np.pad(sequence, (0, BLOCK - len(sequence) % BLOCK))
        source = iter(sequence.reshape(-1, BLOCK))

        async def next_frame():
            return next(source)

        captured = await Microphone.record(SimpleNamespace(read=next_frame), {"first_listen": 8, "silence": 0.9})
        captured_text = await asyncio.to_thread(transcribe, whisper, captured, "en")
        if "windows" not in captured_text.lower() or "test" not in captured_text.lower():
            raise AssertionError("Post-chime command capture lost the spoken test sentence")
        results["post_chime_command_capture"] = "pass"
        await speaker.speak("Hey Jarvis.", output=speech)
        audio = np.concatenate([np.zeros(RATE), read_wave(speech), np.zeros(RATE)])
        samples = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        maximum = 0.0
        for offset in range(0, len(samples) - BLOCK, BLOCK):
            maximum = max(maximum, max(wake.predict(samples[offset:offset + BLOCK]).values()))
        results["synthetic_wake_score"] = round(float(maximum), 4)
        results["synthetic_wake_detected"] = bool(maximum >= 0.5)
        await speaker.speak("Hi Jarvis.", output=speech)
        audio = np.concatenate([np.zeros(RATE), read_wave(speech), np.zeros(RATE)])
        samples = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        candidate = ended_speech([samples])
        if candidate is None or wake_command(await asyncio.to_thread(transcribe, whisper, candidate, "en")) is None:
            raise AssertionError("Speech-verified Hi Jarvis fallback failed")
        results["synthetic_hi_jarvis_fallback"] = "pass"
    if speak:
        await speaker.speak("Timmy's Windows speech output is working.")
        results["speaker_test"] = "played; human audibility confirmation required"
    if capture:
        mic = Microphone()
        peaks = []
        try:
            mic.stream.start()
            for _ in range(38):
                frame = await asyncio.wait_for(mic.read(), timeout=2)
                peaks.append(int(np.max(np.abs(frame.astype(np.int32)))))
            results["microphone"] = {"frames": len(peaks), "peak": max(peaks), "overflows": mic.overflows}
        finally:
            mic.close()
    print(json.dumps(results), flush=True)
