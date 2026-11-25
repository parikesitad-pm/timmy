# Timmy Windows pilot

Updated: 25 November 2026. Windows x64 core and hands-free voice are installed and running. Current work is final hosted verification and documentation handoff; implementation does not stop at a documentation update.

## Current result

- Timmy 0.2.0 is installed at C:/Users/drvc-/AppData/Local/Programs/Timmy/timmy.exe. User PATH includes its directory. Existing profile/history were preserved; initial config uses codex/default and keyword-only memory.
- Say **Hey Jarvis** or **Hi Jarvis**, wait for the two-note cue, then speak. Dap explicitly confirmed the combined cue + spoken answer with CMD/PowerShell closed and no window appearing. That final confirmation supersedes earlier partial tests and mistaken clicks.
- Windows voice uses local microphone capture, ONNX neural wake detection plus speech-verified Jarvis fallback, CPU/int8 Whisper, speech-based command endpointing and SAPI for both cue and replies. It is half-duplex; Linux voice and echo-cancelled barge-in are not implemented.
- Core owns voice startup and authenticated graceful shutdown. Repeated installed stop/repair/start checks pass; old voice processes exit before core restart. Voice autostart with core is enabled. Login-trigger acceptance remains separate.
- Dap's full-access grant is applied to the main Codex provider and askCodex. An actual Codex turn created a uniquely named temporary Desktop file outside the workspace; the host verified its marker and removed it without inspecting other Desktop files. Screen/mouse UI automation is not installed.

## Stage index

| Stage | Goal / dependency                                 | Status                                        | Record                                              |
| ----- | ------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| GN-01 | Toolchain/build; none                             | done                                          | [Baseline](plan/gn-01-windows-baseline.md)          |
| GN-02 | Init, real chat, console, persistence; GN-01      | done                                          | [Foreground](plan/gn-02-core-foreground.md)         |
| GN-03 | Logs/editor/image/plugin paths; GN-02             | done                                          | [Portability](plan/gn-03-cli-portability.md)        |
| GN-04 | Readiness/stop/Scheduler; GN-03                   | in-progress; actual login parked              | [Lifecycle](plan/gn-04-daemon-lifecycle.md)         |
| GN-05 | Optional integration matrix; GN-04 implementation | in-progress; remaining optional checks parked | [Integrations](plan/gn-05-optional-integrations.md) |
| GN-06 | Windows/Ubuntu CI; GN-05 matrix                   | in-progress; latest permission delta pending  | [CI](plan/gn-06-windows-ci.md)                      |
| GN-07 | Binary/checksums/installer; GN-06                 | in-progress; remaining acceptance parked      | [Release](plan/gn-07-windows-release.md)            |
| GN-08 | Vesper identity/custom wake; Windows handoff      | planned, parked by dap                        | [Vesper](parked/gn-08-vesper-identity.md)           |
| GN-09 | Windows hands-free Jarvis; working core           | in-progress; final hosted checks only         | [Voice](plan/gn-09-windows-handsfree.md)            |

Active: GN-09.06. Next: verify hosted Windows/Ubuntu checks for the final implementation revision, synchronize done statuses and leave the installed service running. Do not resume Vesper automatically.

## Verification

- Windows x64; Node 24.22.3, pnpm 11.6.0, Bun 1.3.9. Managed Python 3.12.16 and uv 0.13.10 for voice; system Node/Python unchanged. Python dependencies are frozen in the package's uv.lock.
- Build/typecheck/lint pass. Full suite before the last permission-mapping test: core 439 + SDK 4 pass, one existing macOS external-bundle skip. New provider permission tests: 10 pass across mapping/provider files. Nine Python audio/endpointing/control/cleanup tests pass.
- Synthetic real-engine checks pass: STT, neural Hey Jarvis score 0.9985 at threshold 0.5, Hi Jarvis speech fallback, and chime -> pause -> speech capture through VAD/STT. Real mic: 38 frames, peak 2088, zero overflows. Synthetic evidence is distinct from dap's final live confirmation.
- Final Windows executable is about 113.5 MiB. Node-absent PATH checks pass for init/editor/foreground/chat/history/background/repeated-start/stop/busy cancellation/occupied-port and actual ConPTY TUI, UTF-8 logs, resize and Ctrl+C. Installer checksum/update/mismatch/uninstall/profile-preservation checks pass.
- Hosted core CI is green on both Windows and Ubuntu for 6ceffe8: [run 45617671911](https://github.com/parikesitad-pm/timmy/actions/runs/45617671911). Windows standalone/installer artifact job also passed at that revision: [run 45617671807](https://github.com/parikesitad-pm/timmy/actions/runs/45617671807). macOS artifact runner remains queued; final permission-mapping delta is being verified next.
- Earlier actual native credential roundtrip, official ONNX CPU identity inference, VS Code native CLI and Limited/Interactive Task Scheduler registration/explicit launch/removal pass. No credential values were printed.
- One idle sample with voice after acceptance: about 400.5 MiB voice + 191.5 MiB core, normalized CPU about 0.58%. This is not a transcription peak or an Arch measurement. Voice inference uses CPU; Codex generation is remote.

## Parked work and resume conditions

- [GN-04.06 actual sign-in](parked/gn-04-login-acceptance.md): explicit Scheduler launch passes; resume during a user-controlled login cycle. Next: health/single-instance check after login. Never log dap out automatically.
- [GN-05.03 / GN-07.02 full text embeddings and standalone ONNX](parked/gn-05-embedding-validation.md): keyword fallback/native identity inference pass; sentence-model/standalone native loading remain unverified. Next: an explicit real embedding probe. Voice wake embeddings do not prove sentence-memory embeddings.
- [GN-05.07 external macOS bundle](parked/gn-05-machine-plugin.md): existing skip; resume on macOS with the sibling bundle built. Next: run its integration case.
- [GN-07.04 clean-machine acceptance](parked/gn-07-clean-machine.md): Node-masked developer/hosted Windows tests pass; clean bare VM remains untested. Next: installer/init/real chat/stop on that VM.
- [GN-08 Vesper/hi vesper](parked/gn-08-vesper-identity.md): explicitly deferred by dap. Live Jarvis now works; wait for dap to resume the rename/custom model work. Preserve the platform split requested: Windows/Linux Vesper, macOS Timmy.
- [GN-03 resumed tasks](parked/gn-03-cli-portability-remaining.md): completed; no blocker remains.
- [GN-05.05 upstream gap history](parked/gn-05-windows-voice.md): resumed and addressed by this repo's Windows backend; current acceptance is in GN-09, not blocked solely by upstream anymore.

## Review and handoff

[Draft PR #1](https://github.com/parikesitad-pm/timmy/pull/1), branch codex/windows-codex-sdk. No merge, release tag or publication has occurred. Artifacts are in ignored release/. [Validation](plan/validation.md), [Windows guide](docs/WINDOWS.md), [runbook](plan/windows-runbook.md). Global workflow preferences remain in global instructions; this project's progress stays here. persona-tujuh was not edited.
