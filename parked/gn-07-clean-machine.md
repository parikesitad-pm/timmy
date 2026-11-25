# GN-07.04 - clean Windows VM acceptance

Status: planned, parked. Dependencies: [GN-07](../plan/gn-07-windows-release.md) artifacts and a clean Windows x64 VM.

- [ ] GN-07.04 - Install verified artifacts on a clean machine without Node, configure a native Codex executable/login, and verify init, health, actual chat, restart, stop and uninstall.

The final executable passes with node.exe absent from the application's PATH on the development host, including native ConPTY tests and SQLite persistence. Installer isolation and checksum mismatch tests pass. This is narrower than a clean VM, which was not supplied. Resume on that VM; next action: follow docs/WINDOWS.md and record OS/runtime/native dependencies. No release publication is implied. [Pilot](../pilot.md).
