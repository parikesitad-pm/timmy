# Windows x64

Timmy 0.2.0 supports a native Windows CLI and a standalone executable. Text chat can use an existing native Codex CLI login or another configured provider. Codex runs as a separate native process; this chat session is not embedded in Timmy.

## Install the local release artifacts

Keep timmy-windows-x64.exe, SHA256SUMS and install.ps1 together, then run:

    powershell.exe -NoProfile -File .\install.ps1

The installer checks SHA-256 before changing the installation, installs under LocalAppData\Programs\Timmy and updates the current user's PATH. Open a new terminal, then:

    codex login status
    timmy init
    timmy start
    timmy chat

Choose codex/default during init to follow the model in the Codex configuration. Optional plugins can be declined. CODEX_PATH can point to a native codex.exe when it is not available through PATH. A Windows npm .cmd wrapper is not a native executable.

## Daily use

    timmy status
    timmy logs -f
    timmy stop
    timmy model use codex/default
    timmy model askcodex default
    timmy autostart on
    timmy autostart status
    timmy autostart off

Stop uses an authenticated local pipe and waits for cleanup and process exit. An explicit stop --force is available for a known legacy instance; it reports that cleanup was not guaranteed. Login autostart uses a current-user, Limited/Interactive scheduled task. It does not require a system service or administrator credentials.

TIMMY_HOME selects an independent application profile; its config, database, PID/control records and logs stay under that directory. HOME is not changed. Different profiles have different scheduled-task names. Configure different ports if multiple profiles run together.

The profile editor defaults to Notepad. EDITOR/VISUAL can select an executable and arguments. The standard VS Code code.cmd shim is resolved to its native executable and CLI entry with the required Electron environment, without invoking a free-form shell.

## Updates and uninstall

Run the same installer with the new verified artifacts to update. It stops the installed instance for the selected TIMMY_HOME first. Stop other running profiles before replacing their shared executable. It refuses to overwrite an unmanaged timmy.exe.

    powershell.exe -NoProfile -File .\install.ps1 -Uninstall

Uninstall removes the managed executable, installation manifest and its user PATH entry. Profiles/history and unrelated files are preserved. Disable autostart for each enabled profile before uninstalling. InstallDirectory selects a custom location; NoPathUpdate is available for isolated validation.

## Optional features and validation

Windows text chat, persistence, graceful foreground/background control and the console UI are covered by native tests. The standalone flow is also tested with Node absent from the child PATH. Native Windows credential storage and ONNX CPU inference are checked separately; a full text-embedding model download is an optional, separate check. Set models.embedding to none for keyword-only recall without a model download.

Windows hands-free voice uses the backend in this repository: ONNX “Hey Jarvis” detection, CPU/int8 Whisper recognition, and Windows SAPI speech output. Install uv, then run `timmy voice install --yes`, `timmy voice start`, and `timmy voice status`. Say **Hey Jarvis**, wait for the beep, then speak. `timmy voice stop` closes the microphone and speech process. `timmy voice autostart on` starts voice with core; `timmy voice install --repair --yes` updates the installed voice source without deleting cached models.

Voice requires managed Python 3.12 and downloads its locked dependencies/models on first install. CUDA is not required; system Python is preserved. This Windows backend pauses listening during recognition/replies; echo-cancelled barge-in is not implemented. Output pronunciation depends on installed SAPI voices. Microphone audio is not saved; recognized text follows normal core chat/history handling. Native engine and microphone checks are separate from a user's live wake-word acceptance. See pilot.md for the current acceptance result. macOS keeps its separate upstream backend; Linux voice remains pending.

## Build from source

Use Node 24, pnpm 11.6.0 and Bun 1.3.9:

    pnpm install --frozen-lockfile
    pnpm build:windows
    pnpm smoke:windows

The executable, per-asset checksum, SHA256SUMS and installer are written to release/. CI uses a local provider fixture without account credentials. Live Codex and native capability checks are separate commands; their results are recorded in plan/validation.md.
