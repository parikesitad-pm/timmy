# GN-08 - Vesper identity and wake phrase

Status: planned, parked at dap's explicit request on 25 November 2026. Finish the authorized Windows work first; no rebrand implementation has started.

## Goal and scope

Windows/Linux product and CLI become Vesper / vesper; macOS remains Timmy / timmy. Target wake phrase: "hi vesper". Preserve existing profiles, history and plugin compatibility.

## Dependencies and tasks

- [ ] GN-08.01 - After the Windows handoff, implement platform-specific product/CLI names and update help, UI, artifacts, installer and documentation.
- [ ] GN-08.02 - Migrate the installed command safely while preserving configuration/history and avoiding duplicate daemons.
- [ ] GN-08.03 - Train/import a genuine "hi vesper" wake model and validate audio detection when supported audio backends are available. Changing a display phrase does not train detection.

Dependency: GN-01 through GN-07 Windows core/release handoff; voice detection additionally needs the backend tracked in [GN-05.05](gn-05-windows-voice.md).

## Output, verification and handoff

Expected output: reviewed platform identity change and separate actual wake-model evidence. Verify Windows/Linux command/help/installer and preserved profiles; verify macOS branding remains Timmy. Do not claim a wake change from a text/config edit. Resume when dap asks to make the change after the Windows work. Next action: resume GN-08.01 from this record, then synchronize [pilot](../pilot.md).
