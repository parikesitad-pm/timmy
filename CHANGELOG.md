# Changelog

Windows hands-free voice adds real microphone capture, pretrained Hey Jarvis ONNX detection, CPU/int8 Whisper recognition, Windows SAPI output, locked Python dependencies, authenticated readiness/control and graceful microphone/speech cleanup. macOS retains its existing voice backend. Vesper branding/custom wake detection remains deferred.

## 0.2.0 — 2026-11-24

- Add native Windows foreground/background lifecycle, authenticated shutdown, readiness checks and current-user login tasks.
- Build a Windows x64 executable, checksums and a PowerShell installer with update/uninstall validation.
- Replace Claude Agent SDK with Codex SDK. The provider/tool names are now codex and askCodex; configure the provider through init or model use codex/default.
- Add TIMMY_HOME profiles, portable log following, Windows editor command resolution and drive/UNC/quoted image paths.
- Close SQLite resources during shutdown and cancel active chat streams before draining HTTP/WebSocket connections.
- Add Windows/Ubuntu CI and native Windows console checks. Report the upstream Windows voice backend as unavailable without blocking text chat.
