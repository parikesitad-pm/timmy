# GN-06 - Windows and Ubuntu CI

Status: done. Verified implementation revision 7406534 on 25 November 2026. Dependency: GN-05 compatibility matrix; next: independent GN-07 release acceptance.

## Goal and scope

Repeat install/build/typecheck/tests/lint and core lifecycle checks on Windows and Ubuntu at the same revision, without account credentials. Release publication and the separate SonarCloud review gate are outside this CI stage.

## Tasks

- [x] GN-06.01 - Windows/Ubuntu matrix, Node 24 and pinned pnpm 11.6.0.
- [x] GN-06.02 - No dependency on local noir/Vibe Guard hooks or machine-specific paths.
- [x] GN-06.03 - Both jobs pass frozen install, build, typecheck, tests, lint and fixture integration smoke on the same final implementation revision.
- [x] GN-06.04 - Cover spaced paths, lifecycle, active-stream cancellation and native ConPTY on Windows; install frozen Windows voice dependencies and test its logic/control without a microphone/model download.
- [x] GN-06.05 - Isolated TIMMY_HOME and loopback provider fixture; no account credentials or deny-list reads.

## Output, completion criteria and verification

[Final CI run 45632110084](https://github.com/parikesitad-pm/timmy/actions/runs/45632110084), SHA 7406534af92e13dd5fb6c348150b455319eb36e4: Windows and Ubuntu both succeed. JS/SDK tests: 444 pass; one existing external macOS bundle skip. Windows Python tests: 10 pass. The separate Windows binary/installer job succeeds in [run 45632109946](https://github.com/parikesitad-pm/timmy/actions/runs/45632109946).

The initial invalid runner context was corrected, interactive console checks explicitly clear CI flags inside the pseudoconsole child, and the console harness can deliver an actual Windows Ctrl+C event where hosted ConPTY does not translate the input byte. Latest hosted scenarios pass. Workflow concurrency cancels superseded runs.

## Handoff

[GN-07](gn-07-windows-release.md) retains macOS host capacity, clean-VM/optional-native acceptance and the independent automatic review gate. [GN-09](gn-09-windows-handsfree.md) is done and the installed service remains running. [Pilot](../pilot.md) is synchronized; no merge/tag/publication.
