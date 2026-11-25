# Timmy voice for Windows

Native half-duplex hands-free voice: say **Hey Jarvis**, wait for the short beep, then speak. Audio capture and inference run locally. Recognized text goes to the configured core provider; replies use installed Windows SAPI voices. Microphone audio is not saved.

The Windows backend uses sounddevice, openWakeWord's ONNX Hey Jarvis model, and multilingual faster-whisper base on CPU/int8. CUDA is not required. It pauses listening during recognition and replies to prevent speaker feedback. It does not implement echo-cancelled barge-in. macOS continues using the existing separate upstream backend.

Run `timmy voice install --yes`, `timmy voice start`, `timmy voice status`, and `timmy voice stop`. Enable `timmy voice autostart on` to start voice with core. Initial installation needs uv and managed Python 3.12 and downloads the locked dependencies and models. System Python remains unchanged. The standalone executable embeds the Python source and lockfile; Python/model files are installed in the selected TIMMY_HOME profile.

Developer checks: `uv sync --frozen --python 3.12`, then `.venv/Scripts/python.exe -m unittest discover -s tests`. `python -m timmy_voice_windows probe --speak --capture` performs synthetic wake/STT, speaker playback, and a short microphone-level check. Synthetic detection is separate from a user's live wake-word acceptance.

Wake model source: [openWakeWord](https://github.com/dscripka/openWakeWord), official v0.5.1 model assets, used through openWakeWord 0.6.0. Keep upstream model/code licenses with redistributions. Whisper models come from the faster-whisper model repository. Custom “hi vesper” detection and product renaming remain parked until live Hey Jarvis acceptance.
