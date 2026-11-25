# gn-01-windows-baseline

- Status: done.
- Verified: 24 November 2026, Windows x64, Node v24.22.3, pnpm 11.6.0.
- Dependency: none.
- Next: [GN-02 foreground](gn-02-core-foreground.md), subsequently verified; current work is indexed in pilot.md.

## Goal and scope

Establish a reproducible Windows workspace build. The user also authorized replacing Claude Agent SDK with Codex SDK. Runtime chat, background lifecycle and release packaging have separate stages.

## Tasks

- [x] GN-01.01 â€” Install and verify Node 24 with fnm; retain the existing system Node 26 installation.
- [x] GN-01.02 â€” Record the original guard scans, then apply the user's explicit revocation. Noir is no longer a build gate.
- [x] GN-01.03 â€” Frozen install, SDK/core build, typecheck, full tests, lint, version and help executed successfully.
- [x] GN-01.04 â€” Record versions, observed Windows failures, fixes and final exit codes.
- [x] GN-01.05 â€” Replace Claude Agent SDK with Codex SDK 0.171.0, provider codex, tool askCodex, CLI/init/prompt and regression tests.

## Output and completion criteria

- [x] Dependencies installed with the migrated lockfile frozen; no subsequent lockfile change required by install.
- [x] Build, typecheck, test, lint, version and help exit 0 on Windows / Node 24.
- [x] Identified Windows failures resolved with regression coverage.

## Verification evidence

| Check                                         | Result                                                               |
| --------------------------------------------- | -------------------------------------------------------------------- |
| pnpm install --frozen-lockfile                | Exit 0; ONNX/esbuild postinstall passed                              |
| pnpm build                                    | Exit 0; SDK/core built; TUI bundle 25.19 KB                          |
| pnpm typecheck                                | Exit 0                                                               |
| pnpm lint                                     | Exit 0                                                               |
| pnpm test                                     | Exit 0; core 430 passed + 1 existing skip, SDK 4 passed              |
| CLI version and help                          | Exit 0; Timmy v0.1.0; askCodex shown                                 |
| Windows environment probe                     | Exit 0; all six probes passed                                        |
| Native Codex CLI authentication               | Available, checked through login status without exposing credentials |
| Actual Codex SDK import / thread construction | Passed; no model turn sent                                           |
| Codex-specific tests                          | 9 passed across provider, delegation and chat integration            |

Use the installed Node-24 pnpm shim so Turbo child tasks use the pinned package manager:

    fnm exec --using 24 pnpm.cmd build
    fnm exec --using 24 pnpm.cmd typecheck
    fnm exec --using 24 pnpm.cmd test
    fnm exec --using 24 pnpm.cmd lint

The initial Corepack command let Turbo resolve a global pnpm 12.9.1 shim. Corepack pnpm shims were enabled in the Node-24 installation; both parent and child tasks now use 11.6.0. No version checks were disabled.

Initial downloads timed out. SDK 0.172.0 was rejected by pnpm's release-age policy; 0.171.0 satisfies that policy without exemptions. The migrated lockfile removes Claude Agent SDK. The SDK is imported dynamically because its package only exports ESM and Timmy emits CommonJS.

The three initial test failures were POSIX-only image extraction (two tests) and a POSIX-only assertion in the macOS autostart path test. Drive/UNC/quoted-path support and a native path assertion resolve them. No assertions were weakened or tests newly skipped.

## Handoff and limits

The existing skipped external macOS machine-plugin test is tracked as [GN-05.07](../parked/gn-05-machine-plugin.md). Those checks were unverified at this baseline checkpoint; subsequent live chat, native ConPTY, restart and graceful lifecycle results are recorded in validation.md. A unit runtime boot created the default test database under the previously absent user .timmy directory; no pre-existing Timmy profile was present.

[GN-03](gn-03-cli-portability.md) records early portability work. [Validation](validation.md) contains the final check summary. Continue from [pilot.md](../pilot.md).
