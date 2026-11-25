# GN-07 - Windows release artifacts

Status: in-progress; local executable and installer verified, clean-machine/native-module acceptance pending. Dependency: [GN-06](gn-06-windows-ci.md) hosted results. Publication requires a separate request.

## Goal and scope

Produce a native Windows x64 executable, checksums, installer and reviewable notes while preserving the existing macOS target.

## Tasks

- [x] GN-07.01 - Bun 1.3.9 build script supports Windows x64 and darwin arm64; release workflow builds both. Hosted cross-platform build results remain part of GN-06 verification.
- [ ] GN-07.02 - Standalone Bun SQLite persistence and embedded TUI pass; native credential reads occur during provider boot. [Full standalone ONNX/DLL and sentence-model validation remains parked](../parked/gn-05-embedding-validation.md).
- [x] GN-07.03 - PowerShell installer verifies Get-FileHash SHA-256 before mutation; spaced paths, managed update/uninstall and profile preservation pass.
- [ ] GN-07.04 - Version/init/foreground/chat/history/background/stop/TUI/log/Ctrl+C pass with Node absent from app PATH on this host. [Clean Windows VM acceptance remains parked](../parked/gn-07-clean-machine.md).
- [x] GN-07.05 - 0.2.0 executable, checksums, install.ps1, changelog and Windows usage notes prepared. No tag/release published.

## Output, completion and verification

`release/timmy-windows-x64.exe` is approximately 113.4 MiB. Matching per-asset checksum and SHA256SUMS are generated; checksum-merging script verifies assets before joining records. Production bundling excludes Ink development tools and preserves the real console UI. Native console and lifecycle fixture tests pass without Node in the child PATH, including cancellation and busy stop. Installer mismatch/update/uninstall tests pass.

Completion still requires GN-06 hosted jobs, GN-07.02 optional-native verification and GN-07.04 clean-machine acceptance. Next action: verify hosted builds and provide the local runnable installation. [Windows guide](../docs/WINDOWS.md), [validation](validation.md), [pilot](../pilot.md).
