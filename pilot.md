# Timmy Windows pilot

Updated: 25 November 2026. Windows x64 implementation and final verification are active.

Timmy 0.2.0 now runs as a standalone Windows executable with Codex SDK 0.171.0. The final executable passed native console and lifecycle smoke tests with Node absent from its PATH. This project's progress lives here, `plan/`, and `parked/`; persona-tujuh was not edited.

## Stage index

| Stage | Goal / dependency                                              | Status      | Record                                              |
| ----- | -------------------------------------------------------------- | ----------- | --------------------------------------------------- |
| GN-01 | Toolchain/build; none                                          | done        | [Baseline](plan/gn-01-windows-baseline.md)          |
| GN-02 | Init, chat, console, persistence; GN-01                        | done        | [Foreground](plan/gn-02-core-foreground.md)         |
| GN-03 | Logs, editor, image/plugin paths; GN-02                        | done        | [Portability](plan/gn-03-cli-portability.md)        |
| GN-04 | Readiness, graceful stop, scheduled tasks; GN-03               | in-progress | [Lifecycle](plan/gn-04-daemon-lifecycle.md)         |
| GN-05 | Codex/keyring/embedding/voice matrix; GN-04 implementation     | in-progress | [Integrations](plan/gn-05-optional-integrations.md) |
| GN-06 | Windows/Ubuntu hosted CI; GN-05 matrix                         | in-progress | [CI](plan/gn-06-windows-ci.md)                      |
| GN-07 | Standalone exe/checksum/installer; GN-06 hosted checks pending | in-progress | [Release](plan/gn-07-windows-release.md)            |

Current work: final regression checks, live Codex smoke on 0.2.0, hosted CI verification, and local runnable handoff. Documentation synchronization does not stop implementation.

## Verified results

- Windows x64, Node 24.22.3, pnpm 11.6.0; system Node unchanged. Frozen install, build, typecheck and lint pass.
- Final full suite: core 439 + SDK 4 passed; one existing external macOS plugin-bundle test skipped.
- Real Codex model turns passed through source and standalone builds. Final 0.2.0 actual Codex chat, persisted history and background lifecycle also pass with Node absent from app PATH.
- Final 0.2.0 standalone: init with optional plugins declined; real native ConPTY Unicode/multiline/resize/Escape cancellation/exit; foreground health/chat; history after restart; graceful shutdown receipt; background/repeated start/status/stop; active-response stop; occupied-port failure; log UTF-8/Ctrl+C; foreground Ctrl+C. All passed with Node absent from the app's PATH.
- Cancellation testing found an underlying HTTP request surviving stream cancellation. OpenAI-compatible and Ollama requests now have scoped AbortControllers. The executable rerun passed.
- Installer: checksum verification, install/update in a spaced directory, rejection of a mismatched checksum without changing the installed binary, uninstall, and profile/unrelated-file preservation all pass.
- Earlier native tests passed credential-store write/read/delete with synthetic values, official ONNX identity-model CPU inference, native VS Code shim launch, and Limited/Interactive scheduled-task registration/launch/removal. No credential values were printed.

## Parked acceptance checks

- [GN-04.06 real sign-in](parked/gn-04-login-acceptance.md): scheduled-task launch passed; actual sign-out/sign-in is untested. Resume during a user-controlled login cycle; next action is health/single-instance verification after login. Do not log dap out automatically.
- [GN-05.03 full embedding and GN-07.02 standalone native modules](parked/gn-05-embedding-validation.md): keyword fallback and native ONNX identity inference pass; full sentence-model inference and standalone ONNX loading remain unverified. Resume with explicit model/runtime evidence; next action is a real text embedding probe.
- [GN-05.05 Windows voice](parked/gn-05-windows-voice.md): upstream Windows backend raises NotImplementedError. Resume when upstream provides an audio backend; next action is audit/install/audio/start-stop testing. Core text chat remains functional.
- [GN-05.07 external macOS bundle](parked/gn-05-machine-plugin.md): existing skip because its sibling macOS bundle is absent. Resume on macOS with that bundle built; next action is the plugin-loader integration test.
- [GN-07.04 clean-machine acceptance](parked/gn-07-clean-machine.md): Node-absent PATH smoke passes on this host; a clean VM is still untested. Resume on a clean Windows x64 VM; next action is installer/init/chat/stop with native Codex installed.
- [Completed GN-03 parked tasks](parked/gn-03-cli-portability-remaining.md): resumed and verified; no pending GN-03 tasks remain.

## Handoff

[Verification record](plan/validation.md), [Windows usage](docs/WINDOWS.md), [runbook](plan/windows-runbook.md), [initial audit](plan/windows-adjustments.md). Artifacts are in ignored `release/`. Release publication requires a separate request; no tag or release has been published.

## Active scope update - 25 November

Installed Timmy 0.2.0 at C:/Users/drvc-/AppData/Local/Programs/Timmy/timmy.exe. Existing profile/history preserved; previously absent config initialized with codex/default and keyword-only memory. Background health passes at 127.0.0.1:3737. Draft PR: https://github.com/parikesitad-pm/timmy/pull/1.

Hosted Windows and Ubuntu CI both pass at revision 934efc1 (run 45595877186). Windows artifact testing exposed a hosted console-control delivery difference; its native-control harness fix passes locally. macOS artifact runner remains queued. Latest source fixes additionally await stop before voice uninstall and bound regex work.

Active stage: [GN-09 Windows hands-free](plan/gn-09-windows-handsfree.md). Dap explicitly expanded the goal to live Hey Jarvis operation. The prior upstream Windows voice limitation is now being addressed with a local Windows backend; GN-05.05 resumes through GN-09. [GN-08 Vesper/hi vesper](parked/gn-08-vesper-identity.md) remains entirely parked until dap can test Hey Jarvis alive. Next: build the Windows audio package and install a managed Python 3.12 runtime; system Python remains unchanged.

## Live Windows voice checkpoint

[GN-09](plan/gn-09-windows-handsfree.md) tasks .01-.04 are verified. The installed CPU voice package uses native microphone capture, neural Hey Jarvis plus a speech-verified Hey/Hi Jarvis fallback, Whisper base recognition, SAPI output, authenticated control and graceful core-owned shutdown. A live wake and completed spoken response passed; dap confirmed hearing the reply. The first neural-only live attempt failed and is recorded as such. The inaudible system beep was replaced by a PCM speaker chime; human cue confirmation and final packaged deployment remain pending. Eight Python tests and 443 JS/SDK tests pass, with the same existing external macOS skip.

GN-05.05 is resumed through GN-09: the upstream Windows implementation gap is addressed by this repository's package. The old parked record is historical, not a current claim that Windows voice is unavailable. [GN-08 Vesper](parked/gn-08-vesper-identity.md) stays parked until dap explicitly resumes the rename after this handoff.

## Latest acceptance evidence

Dap confirmed hearing a live spoken reply after the speech-verified Jarvis fallback was deployed. Runtime PID 20116 subsequently reported one wake and one completed turn, then returned to asleep. The system beep was not audible; a normal-output PCM two-note chime replaces it. Chime replay was requested and performed; audibility is still awaiting dap's confirmation. Core-owned voice shutdown has passed repeatedly, with the previous Python runtime gone before core restart.

A one-second idle sample after voice acceptance measured approximately 400.5 MiB for voice and 191.5 MiB for core; total normalized CPU was about 0.58%. This is one idle sample, not a transcription peak or an Arch measurement. Speech verification/inference runs locally on CPU; Codex text generation remains remote. No raw microphone recording or transcript is stored in voice diagnostics.

Latest correction: cue replay is audible through SAPI and native Codex is patched to hide its window. A combined test with terminals closed heard the cue/no CMD but returned an empty command transcription. GN-09 now uses speech-based capture, verified with real VAD/STT on a synthetic post-chime command. Nine Python tests pass. Combined live acceptance is still pending; earlier partial confirmations do not mark GN-09 done.
