# GN-09 - Windows hands-free Hey Jarvis

Status: in-progress. Authorized by dap on 25 November 2026. Dependency: verified Windows core and native Codex chat (GN-02/GN-07). Vesper/GN-08 stays parked until dap can test Hey Jarvis live.

## Goal and scope

Deliver a real Windows microphone -> Hey Jarvis detector -> speech recognition -> core/Codex -> spoken response. Keep macOS on its existing upstream voice backend. Use CPU defaults and preserve the working text daemon.

## Tasks

- [x] GN-09.01 - Implement a Windows voice package using native audio capture, ONNX wake detection, CPU/int8 speech recognition and Windows SAPI output.
- [x] GN-09.02 - Install pinned dependencies/models with managed Python 3.12; preserve system Python 3.15.
- [x] GN-09.03 - Integrate package installation, authenticated readiness, graceful stop and core-owned voice lifecycle into CLI/standalone builds.
- [x] GN-09.04 - Verify actual microphone availability, speech output, wake/STT inference, core response and resource use. Keep synthetic inference evidence distinct from live user speech.
- [x] GN-09.05 - Start the installed hands-free service and have dap test Hey Jarvis. Record detection/turn/cleanup evidence without storing raw microphone audio or transcripts.
- [ ] GN-09.06 - Run regression/hosted checks and synchronize same-project pilot/plans/parked records.

## Output and completion criteria

Working installed voice runtime and reproducible tests. Completion requires actual wake detection and a spoken response confirmed by dap; configuration labels and model import alone are insufficient. No custom hi-vesper model or product rename in this stage.

## Verification and handoff

Use disposable profiles for automated lifecycle tests; use the selected default microphone only for authorized live acceptance. Audio remains local until recognized text is submitted to the configured provider; do not record raw audio by default. Next action: implement and install GN-09.01/02, then integrate and validate. Update [pilot](../pilot.md) and move any truly blocked acceptance steps to parked with exact resume conditions.

## Verification checkpoint - 25 November 2026

- Windows package installed in the existing user profile with Python 3.12.16 and uv 0.13.10. System Python 3.15 remains unchanged. CPU/int8 inference is explicit; CUDA is not required.
- Real microphone probe: 38 frames, peak 2088, zero overflows. Synthetic STT passes; synthetic Hey Jarvis neural score 0.9985 at threshold 0.5. Synthetic Hi Jarvis speech/VAD fallback also passes.
- Initial live neural-only test failed despite audio reaching the detector (best observed score 0.0006). Added bounded local speech verification for Hey/Hi/Hai/Hello Jarvis, activated only on a completed voiced segment. No threshold reduction or raw-audio recording.
- Live wake and spoken response then passed. Dap explicitly confirmed hearing the reply. Status for runtime PID 20116 recorded wake_detections=1, completed_turns=1, wake_method=speech, state=asleep. No user transcript is copied into this record.
- The original Windows system beep was inaudible. Replaced it with a faded two-note PCM chime through normal speaker output. Developer playback/replay completed; human audibility confirmation and final deployment remain pending.
- Windows venv launcher initially introduced a second PID. The supervisor now launches the actual interpreter with this venv's installed packages, so its PID and authenticated runtime record match.
- Actual core stop completed graceful voice cleanup; subsequent startup succeeded. Python tests exercise no-audio idle timeout, bounded input backlog, utterance endpointing, speech child cleanup, authenticated HTTP stop/resource release, strict wake matching and chime output. Eight pass.
- Core/SDK tests: 443 pass plus one existing macOS-only external bundle skip. Build/typecheck/lint and final standalone Node-absent/native-console/installer regressions pass before the last chime packaging update.

Next action: finalize the embedded Python/chime build, verify installed repair/start/stop, run hosted CI on the final revision, and record cue audibility. Vesper remains parked; do not resume it implicitly from this live test.

## Follow-up corrections before final acceptance

Dap corrected the initial cue confirmation: the system/PortAudio cue remained inaudible. The chime now uses SAPI PromptBuilder audio, the same audible output path as spoken replies; dap confirmed hearing its replay. The SDK opened a CMD window during responses; a tracked pnpm patch to SDK 0.171.0 adds windowsHide to its spawn options. Dap confirmed the subsequent live cue was heard and no CMD appeared, but that attempt produced no answer. Logs showed transcription ended empty before core received a request. Command capture now uses Silero speech segmentation instead of a loudness gate; synthetic chime -> pause -> command capture and actual VAD/STT pass. Empty capture/transcription now produces spoken retry feedback. Nine Python tests pass. Final combined live acceptance remains pending; do not mark the stage done from the earlier partial confirmations.

## Final live acceptance and access verification

Dap's latest explicit confirmation: chime + spoken answer work with terminals closed and no window appearing. This supersedes the preceding partial confirmations/mistaken clicks. SAPI now plays both the synthetic two-note WAV cue and spoken replies. Speech-based endpointing replaces the loudness gate; real-engine post-chime capture passes. SDK 0.171.0's tracked windowsHide patch removes the reply console.

- [x] GN-09.07 - Pass configured bypass_permissions to the main Codex provider, not only askCodex. Tests cover both true and false. Dap authorized full access; the installed profile enables it. Actual native Codex created a uniquely named temporary Desktop marker file outside the project; host verification passed and the probe removed it. Other Desktop files were not inspected. This does not add screen/mouse automation.

Hosted Windows and Ubuntu core/voice tests are green for 6ceffe8; Windows binary/installer job also passes. The final permission-mapping delta remains under GN-09.06 verification. Keep this stage in-progress until that result is recorded.
