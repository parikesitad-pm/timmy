# Final Windows verification - 25 November 2026

Accepted implementation: 7406534. This summary supersedes the historical audit and incremental checkpoints below.

| Check                                     | Final result                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Toolchain                                 | Windows x64; Node 24.22.3; pnpm 11.6.0; Bun 1.3.9                                                                                    |
| Python voice                              | Managed Python 3.12.16; uv 0.13.10; frozen uv.lock; system Python preserved                                                          |
| Frozen install / build / typecheck / lint | Pass                                                                                                                                 |
| Tests                                     | Core 440 + SDK 4 + Python 10 pass; one existing external macOS bundle skip                                                           |
| Hosted matrix                             | Windows and Ubuntu both pass on 7406534; [run 45632110084](https://github.com/parikesitad-pm/timmy/actions/runs/45632110084)         |
| Windows binary/installer job              | Pass on same revision; [run 45632109946](https://github.com/parikesitad-pm/timmy/actions/runs/45632109946)                           |
| Release matrix / review gate              | Not fully green; macOS runner capacity and independent review findings remain in GN-07 parked records                                |
| Standalone                                | Timmy 0.2.0, about 113.5 MiB; checksums generated                                                                                    |
| Installed identity                        | SHA256 matches exe, runtime.py, audio.py and settings.py against artifact/source                                                     |
| Node-absent PATH flow                     | Init/editor/health/chat/history/background/stop/busy cancellation/occupied-port pass                                                 |
| Native ConPTY                             | Unicode, multiline, Escape cancellation, resize, /exit, UTF-8 log follow and Ctrl+C cleanup pass                                     |
| Installer                                 | Checksum, spaced paths, install/update, bad-checksum rejection, uninstall, profile/unrelated-file preservation pass                  |
| Native capability checks                  | Credential synthetic roundtrip, actual VS Code CLI, ONNX CPU identity inference and explicit Task Scheduler launch pass              |
| Voice engines                             | Native mic 38 frames / peak 2088 / zero overflows; synthetic STT, 0.9985 neural wake, Hi Jarvis fallback and post-chime VAD/STT pass |
| Live voice                                | Dap confirmed chime + spoken answer with CMD/PowerShell closed and no visible window                                                 |
| Voice lifecycle                           | Core-owned startup; actual interpreter PID readiness; authenticated graceful stop; mic/SAPI cleanup and repeated restart pass        |
| Codex access                              | Full-access mapping true/false tested; grant applied; native Codex created one temporary Desktop file, host verified and removed it  |
| UI automation                             | Not installed; Desktop filesystem evidence is not screen/mouse automation                                                            |
| Resource sample                           | About 400.5 MiB voice + 191.5 MiB core, 0.58% normalized CPU in one idle sample; not peak/Arch evidence                              |

The SDK's tracked one-line windowsHide patch prevents console popups. SAPI plays both the WAV cue and speech through the same audible route. Silero endpointing fixes empty post-chime capture; local speech verification handles Jarvis variants without lowering the neural threshold. Explicit spoken feedback handles empty capture/transcription. Voice auth cannot target a remote HTTP host or a port-based URL redirect; regression tested.

No raw microphone audio is saved in diagnostics. Recognized text uses normal core chat/history handling. Existing personal profile/history are preserved. No merge, tag or release publication occurred. The installed service is left running. [GN-09](gn-09-windows-handsfree.md), [pilot](../pilot.md), and [GN-07 parked review](../parked/gn-07-review-findings.md) contain the detailed handoff.

---

## Historical audit and incremental checkpoints

The following material is retained as historical evidence; its pending statuses are superseded by the final summary above.

## Historical initial audit (before implementation)

Tanggal: 24 November 2026. Status akhir: audit source dan probe lingkungan selesai; runtime Timmy belum diuji.

## Fakta lingkungan yang teramati

- Workspace: Windows, shell PowerShell.
- `node --version`: `v26.13.1`; manifest proyek mensyaratkan >=24.
- Command discovery menemukan node.exe, pnpm.ps1, dan corepack.cmd. Versi pnpm aktif belum diperiksa; manifest pin `pnpm@11.6.0`.
- `node_modules` belum ada saat audit.
- Git working tree bersih sebelum penambahan dokumen dan probe.

## Cakupan pemeriksaan

| Pemeriksaan                                                                                                         | Status                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Baca source CLI, lifecycle, plugin loader, persistence adapter, credential adapter, embedder, manifest dan workflow | Selesai                                                    |
| Identifikasi blocker Windows dan usulan tweak per file                                                              | Selesai; belum diterapkan ke aplikasi                      |
| Konfirmasi sinyal Windows dan batas shim `.cmd`                                                                     | Dokumentasi resmi Node; tautan pada windows-adjustments.md |
| Install dependency / build / typecheck / unit test / lint aplikasi                                                  | Belum dijalankan                                           |
| Boot daemon / provider chat / TUI / riwayat                                                                         | Belum dijalankan                                           |
| Native keyring / ONNX / Claude Code / voice                                                                         | Belum dijalankan                                           |
| Background shutdown / login autostart / binary Windows                                                              | Belum dijalankan                                           |

Hanya `pilot.md` dan isi folder `plan/` ditambahkan. Tidak ada pembacaan file deny-list, akses credential, pembukaan database, install dependency, build, commit, atau push.

## Hasil probe lingkungan

Perintah `node .\plan\windows-probe.mjs` dijalankan pada Windows x64 dengan Node v26.13.1 dan keluar dengan kode 0.

| Probe                                              | Hasil |
| -------------------------------------------------- | ----- |
| Windows native                                     | PASS  |
| Node >=24                                          | PASS  |
| Modul node:sqlite tersedia, tanpa membuka database | PASS  |
| Spawn node.exe tanpa shell                         | PASS  |
| Konversi file URL untuk path Windows dengan spasi  | PASS  |
| HTTP loopback lokal pada port sementara            | PASS  |

Probe hanya membuktikan kemampuan dasar runtime, bukan kompatibilitas Timmy end-to-end. Tidak menguji query SQLite atau native dependency proyek. Source aplikasi tetap tidak diubah.

## Subsequent live voice implementation

See [GN-09](gn-09-windows-handsfree.md) for implementation and acceptance evidence. Eight Python tests pass alongside 443 JS/SDK tests and the existing external macOS skip. Dap confirmed a live wake/spoken response after a local speech-verified Hey/Hi Jarvis fallback was added. Initial neural-only detection failed on the live microphone despite a passing synthetic wake score; that failure is retained in the stage record. Original system beep was inaudible; replacement PCM chime playback/replay performed, human cue confirmation pending. Final standalone packaging embeds the Python source and frozen uv.lock.

## Final accepted implementation: 7406534

Windows and Ubuntu core/voice CI both pass: run 45632110084. Windows executable/installer job passes: run 45632109946 (macOS remains host-capacity dependent). Current tests: 444 JS/SDK + 10 Python passed, with the single existing macOS bundle skip. Installed SHA256 comparison passes for exe, runtime.py, audio.py and settings.py. Dap's latest explicit live acceptance confirms wake/chime/spoken answer with CMD/PowerShell closed and no window. Full Desktop filesystem access is verified by native Codex creating a single temporary marker, independently read and deleted. No other Desktop files were inspected. See GN-09 for the corrected initial failures and final evidence; GN-07 retains separate review/clean-VM/native-model/macOS acceptance. The service is left running.
