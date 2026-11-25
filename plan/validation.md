# Windows verification - 25 November 2026

This current record supersedes the historical initial audit below.

| Check                                                   | Result                                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolchain                                               | Windows x64; Node 24.22.3; pnpm 11.6.0; Bun 1.3.9                                                                                               |
| Frozen install                                          | Pass; final offline frozen-lockfile check also passes                                                                                           |
| Build / typecheck / lint                                | Pass                                                                                                                                            |
| Tests                                                   | Core 439 + SDK 4 passed; one existing external macOS bundle skip                                                                                |
| Final executable                                        | Timmy 0.2.0, approximately 113.4 MiB, matching SHA256SUMS and per-asset checksum                                                                |
| Node absent from child PATH                             | Pass; node.exe spawn returns ENOENT                                                                                                             |
| Init / disposable editor / foreground health            | Pass in standalone fixture and actual Codex runs                                                                                                |
| Actual Codex model response                             | Pass on final 0.2.0 executable using existing native CLI login; synthetic marker prompt only                                                    |
| Persisted history after restart                         | Pass in fixture and live Codex runs                                                                                                             |
| Native Windows console                                  | Pass via real ConPTY: Unicode, multiline, response, resize, Escape cancellation, /exit                                                          |
| Logs / foreground Ctrl+C                                | Pass via real ConPTY; UTF-8 log output and cleanup receipt                                                                                      |
| Background / repeat start / status / stop / repeat stop | Pass; waits for process exit and successful matching cleanup receipt                                                                            |
| Stop during active provider stream                      | Pass after scoped AbortController fix; two regression tests cover request abort and stream cancellation                                         |
| Occupied port / missing exe / readiness failure         | Pass through integration or supervisor tests                                                                                                    |
| Installer                                               | Pass: install/update with spaces, bad checksum rejection before overwrite, uninstall and data/unrelated-file preservation                       |
| Native credential store / VS Code shim                  | Earlier actual Windows roundtrip/CLI tests pass; synthetic credential removed                                                                   |
| Native ONNX                                             | Earlier Node CPU identity-model inference passes; full sentence-model/standalone native loading unverified                                      |
| Task Scheduler                                          | Earlier current-user Limited/Interactive registration, repeated on/off/status, explicit launch, spaces, health/stop pass; real sign-in untested |
| Windows voice                                           | Unsupported upstream; explicit failure and core text-chat fallback verified                                                                     |
| Hosted CI/release matrix                                | Pending remote execution                                                                                                                        |
| Clean Windows VM                                        | Untested; Node-masked developer-host smoke is narrower                                                                                          |

Disposable final fixture evidence: `.timmy-pilot/foreground 1795602007574` (console/full lifecycle) and `.timmy-pilot/foreground 1795602139998` (actual Codex). Values, account credentials and personal chat contents are not recorded here.

A final console test exposed an HTTP provider request surviving cancellation after logical cleanup. Both HTTP providers now abort requests when their stream scope closes; native executable retesting and two regression cases pass. No tests were newly skipped. The remaining existing skip is [GN-05.07](../parked/gn-05-machine-plugin.md).

Pending acceptance and exact resume conditions are linked from [pilot](../pilot.md). No release was published.

---

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
