"""Run the Windows service or perform explicit developer diagnostics."""
import argparse
import asyncio
import json
import sys

from .settings import settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", nargs="?", default="run", choices=["run", "download", "devices", "probe", "chime"])
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--speak", action="store_true")
    parser.add_argument("--capture", action="store_true")
    args = parser.parse_args()
    if sys.platform != "win32":
        parser.error("This package provides the Windows audio backend")
    from .audio import model_fingerprints, wake_model, whisper_model

    cfg = settings()
    if args.command == "chime":
        from .audio import Speaker

        asyncio.run(Speaker(cfg).chime())
    elif args.command == "devices":
        import sounddevice

        print(sounddevice.query_devices())
    elif args.command == "download":
        wake_model(cfg)
        whisper_model(cfg)
        print(json.dumps({"downloaded": True, "wake_sha256": model_fingerprints(cfg)}))
    elif args.command == "probe":
        from .probe import probe

        asyncio.run(probe(cfg, speak=args.speak, capture=args.capture))
    else:
        from .runtime import Voice

        asyncio.run(Voice(cfg).run())


if __name__ == "__main__":
    main()
