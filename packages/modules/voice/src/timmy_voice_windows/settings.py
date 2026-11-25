"""Read the existing core profile without changing or printing its credentials."""
import os
from pathlib import Path

import yaml


def profile_home():
    return Path(os.environ.get("TIMMY_HOME", Path.home() / ".timmy")).resolve()


def settings():
    path = profile_home() / "config.yaml"
    config = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    config = config or {}
    server = config.get("server", {})
    auth = server.get("auth", {})
    token = auth.get("token") if auth.get("enabled", True) else None
    if token == "keychain":
        import keyring

        token = keyring.get_password("timmy", "server:auth_token")
    host = server.get("host", "127.0.0.1")
    if host == "0.0.0.0":
        host = "127.0.0.1"
    language = config.get("assistant", {}).get("language", {}).get("conversation", "auto")
    voice = config.get("voice", {})
    return {
        "home": profile_home(),
        "url": f"http://{host}:{server.get('port', 3737)}",
        "token": token,
        "model": voice.get("stt", {}).get("model", "base"),
        "language": None if language == "auto" else language,
        "wake": voice.get("wake", {}).get("word", "hey_jarvis"),
        "silence": voice.get("conversation", {}).get("end_silence_ms", 900) / 1000,
        "first_listen": voice.get("conversation", {}).get("first_listen_secs", 8),
        "voice": voice.get("tts", {}).get("voice"),
        "rate": voice.get("tts", {}).get("rate", 1.0),
    }
