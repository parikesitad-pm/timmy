# Windows verification runbook

Run from this repository root. Current results are in [validation](validation.md); pending acceptance checks are linked from [pilot](../pilot.md). Daily installation/use is in [docs/WINDOWS.md](../docs/WINDOWS.md).

## Source checks

```powershell
fnm exec --using 24 pnpm.cmd install --frozen-lockfile
fnm exec --using 24 pnpm.cmd build
fnm exec --using 24 pnpm.cmd typecheck
fnm exec --using 24 pnpm.cmd test
fnm exec --using 24 pnpm.cmd lint
fnm exec --using 24 node scripts/windows-smoke.mjs --fixture
```

Use the installed Node-24 pnpm shim so Turbo children inherit pnpm 11.6.0. Windows console checks additionally need Python for the ctypes ConPTY harness; Timmy itself does not require Python for text chat.

## Standalone checks

```powershell
pnpm build:windows
$env:TIMMY_EXECUTABLE = Join-Path (Get-Location) 'release/timmy-windows-x64.exe'
$env:TIMMY_NO_NODE_PATH = '1'
$env:TIMMY_TEST_CONSOLE = '1'
fnm exec --using 24 node scripts/windows-smoke.mjs --fixture
powershell.exe -NoProfile -File scripts/windows-installer-smoke.ps1
```

The harness creates its own TIMMY_HOME under ignored .timmy-pilot. It does not repurpose HOME or overwrite a personal profile. No-Node mode masks the app's PATH and verifies node.exe cannot launch. The harness host still uses Node/Python, so this is not a clean-VM claim.

For actual Codex, remove TIMMY_TEST_CONSOLE and run windows-smoke.mjs without --fixture. It checks native codex.exe/CODEX_PATH and existing login, sends a synthetic response-marker prompt, and tests restart/history/control. Optional capability and Task Scheduler checks use separate scripts; the Scheduler check removes its own task and does not log the user out.

Real sign-in, a clean Windows VM, full sentence embeddings/standalone ONNX and upstream Windows voice limits have separate parked records. Keep them distinct from the passing core flow. Release publication is a separate action.
