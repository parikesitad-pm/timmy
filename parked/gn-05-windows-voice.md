# GN-05.05 - Windows audio backend

Status: blocked, parked. Dependency: upstream timmy-voice Windows implementation.

- [ ] GN-05.05 - Install and test Windows microphone/STT/TTS, start/stop and child cleanup once an audio backend exists.

Audited upstream commit 9ecab77aa8b1b611d0ebb0f1f69b605e16a6f00e. Backend registry supports darwin; win32 raises NotImplementedError. Python preflight supports Windows candidates and >=3.11. Core warns and continues text chat; voice commands fail explicitly rather than pretending audio works. Resume when upstream implements Windows audio. Next action: audit the new backend then exercise actual devices and cleanup. [Stage](../plan/gn-05-optional-integrations.md), [pilot](../pilot.md).
