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
    hosts = {
        "127.0.0.1": "http://127.0.0.1", "localhost": "http://localhost",
        "::1": "http://[::1]", "0.0.0.0": "http://127.0.0.1", "::": "http://[::1]",
    }
    base = hosts.get(server.get("host", "127.0.0.1"))
    port = server.get("port", 3737)
    if base is None or type(port) is not int or not 0 < port < 65536:
        raise ValueError("Windows voice requires a local core and a valid numeric port")
    language = config.get("assistant", {}).get("language", {}).get("conversation", "auto")
    voice = config.get("voice", {})
    return {
        "home": profile_home(),
        "url": f"{base}:{port}",
        "token": token,
        "model": voice.get("stt", {}).get("model", "base"),
        "language": None if language == "auto" else language,
        "wake": voice.get("wake", {}).get("word", "hey_jarvis"),
        "silence": voice.get("conversation", {}).get("end_silence_ms", 900) / 1000,
        "first_listen": voice.get("conversation", {}).get("first_listen_secs", 8),
        "voice": voice.get("tts", {}).get("voice"),
        "rate": voice.get("tts", {}).get("rate", 1.0),
    }
