# GN-05.05 - upstream Windows audio gap, resumed locally

Status: resumed into [GN-09](../plan/gn-09-windows-handsfree.md); no longer blocked solely by upstream. The original upstream audit still stands: commit 9ecab77aa8b1b611d0ebb0f1f69b605e16a6f00e has no working win32 backend.

Dap subsequently authorized implementing Windows hands-free operation here. `packages/modules/voice` now supplies the Windows backend; macOS retains upstream. Native microphone, synthetic model inference, lifecycle control and a live wake/spoken reply are verified. Dap confirmed hearing the reply. Cue audibility and final packaging/CI are tracked in GN-09.

- [ ] GN-05.05 - Final acceptance is synchronized through GN-09.05/.06; do not infer full-duplex AEC or Linux support from the Windows half-duplex result.

Next action: complete the GN-09 handoff and return its result to [GN-05](../plan/gn-05-optional-integrations.md) and [pilot](../pilot.md). No upstream repository was modified. Vesper/hi-vesper remains a separate parked stage.
