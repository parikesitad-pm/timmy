# GN-09 - Windows hands-free Jarvis

Status: done. Verified 25 November 2026 at implementation revision 7406534. Dependencies: GN-02 verified core/chat and GN-07 verified local/hosted Windows executable. Vesper remains parked by dap's explicit instruction.

## Goal and scope

Windows microphone -> Hey/Hi Jarvis -> speech recognition -> native Codex/core -> audible response, without an open terminal or visible CMD window. CPU defaults; preserve the existing profile/history and macOS upstream backend. Full-duplex AEC and Linux voice are outside this Windows implementation.

## Tasks

- [x] GN-09.01 - Implement native capture, ONNX neural wake plus speech-verified Jarvis fallback, CPU/int8 Whisper and SAPI output. The two-note PCM cue uses SAPI's audio path as well.
- [x] GN-09.02 - Install frozen uv.lock dependencies and models with uv 0.13.10 / managed Python 3.12.16; system Python 3.15 is preserved.
- [x] GN-09.03 - Embed source/lockfile in the standalone executable; install/repair without removing cached models; authenticated readiness/stop; actual interpreter PID ownership; core-owned startup and graceful mic/speech cleanup.
- [x] GN-09.04 - Verify real microphone availability, actual inference and speech output, synthetic post-chime command capture, resource use and core replies. Keep synthetic evidence distinct from live acceptance.
- [x] GN-09.05 - Dap confirmed live chime + spoken answer with CMD/PowerShell closed and no window appearing. Latest explicit confirmation supersedes earlier partial results and accidental button selections.
- [x] GN-09.06 - Build/typecheck/lint, JS/SDK/Python regressions, hosted Windows/Ubuntu matrix, hosted Windows executable/installer, installed-file identity and same-project documentation synchronized.
- [x] GN-09.07 - Pass Codex bypass_permissions to the main provider as well as askCodex; test true/false; apply dap's full-access grant. Actual native Codex wrote a temporary Desktop marker outside the workspace; host verified it and removed it. No other Desktop files were inspected. Screen/mouse automation is not installed.

## Output and completion criteria

Timmy 0.2.0 and its Windows voice package are installed and left running. Voice autostart with core is enabled; stop/start ownership has been verified. Working live wake/cue/reply with terminals closed, truthful provider access, final source/installed identity and reproducible regression checks satisfy this stage. Actual login-trigger/clean-VM acceptance and release review remain in their own stages; no claim of merge or publication.

## Verification

- [Windows + Ubuntu CI](https://github.com/parikesitad-pm/timmy/actions/runs/45632110084): both success on 7406534.
- [Windows executable/installer job](https://github.com/parikesitad-pm/timmy/actions/runs/45632109946): Windows job success on the same revision; macOS job queued for host capacity, so the overall release workflow is not reported green.
- JS/SDK suite: 444 passing, one existing external macOS bundle skip. Python: 10 passing. The main-provider permission regression tests cover on/off behavior. Native console and installer scenarios remain covered.
- Actual microphone: 38 frames, peak 2088, zero overflows. Real synthetic engines: STT passes; neural Hey Jarvis score 0.9985 at threshold 0.5; Hi Jarvis fallback and chime -> pause -> command capture through real VAD/STT pass. Raw microphone audio is not saved.
- Final human acceptance: dap explicitly confirmed chime and spoken reply with terminals closed and no popup. Subsequent service status recorded two wakes and two completed turns, then asleep.
- SHA-256 comparison confirms the installed executable, runtime.py, audio.py and settings.py match the final artifact/source.
- One idle sample: about 400.5 MiB voice + 191.5 MiB core and 0.58% normalized CPU. Not a peak or Arch measurement. Voice uses CPU; Codex generation is remote.

## Decisions from confirmed failures

The neural-only live detector missed a phrase despite synthetic success, so a bounded local speech-verification fallback was added rather than lowering the wake threshold. System/PortAudio cues were not audible; SAPI PromptBuilder now plays the WAV cue through the same output path as replies. SDK 0.171.0 spawned a visible console; the tracked pnpm patch adds windowsHide. Loudness-based command capture yielded empty transcription; Silero speech segmentation and explicit spoken retry feedback replace it. Venv launcher/runtime PID mismatch was fixed by launching the actual interpreter with the venv packages. Voice auth is restricted to explicit loopback hosts and valid numeric ports.

## Handoff

[GN-08 Vesper](../parked/gn-08-vesper-identity.md) remains parked until dap explicitly resumes it. [GN-07 release review](gn-07-windows-release.md) retains macOS capacity, optional native model, clean-machine and automatic-review work. [GN-04 actual login](../parked/gn-04-login-acceptance.md) is manual acceptance. Continue from [pilot](../pilot.md), not a new roadmap. No persona-tujuh changes, merge, release tag or publication.
