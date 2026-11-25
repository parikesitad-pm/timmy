# GN-06 - Windows CI

Status: in-progress; workflow implemented, hosted results pending. Dependency: [GN-05](gn-05-optional-integrations.md) compatibility matrix. Next: [GN-07](gn-07-windows-release.md).

## Goal and scope

Repeat build/regression/lifecycle checks on Windows and Ubuntu at the same revision. This stage does not publish releases.

## Tasks

- [x] GN-06.01 - Add Windows/Ubuntu matrix, Node 24 and manifest-pinned pnpm 11.6.0.
- [x] GN-06.02 - Remove reliance on local noir/Vibe Guard paths/hooks.
- [ ] GN-06.03 - Frozen install/build/typecheck/tests/lint and fixture smoke are configured; verify both hosted jobs pass.
- [x] GN-06.04 - Cover spaced paths/lifecycle/cancellation; native ConPTY on Windows; optional account/network/audio tests remain separate.
- [x] GN-06.05 - Use isolated TIMMY_HOME and a loopback provider fixture without account credentials or deny-list reads.

## Output, completion and verification

`.github/workflows/ci.yml` contains the matrix and complete local fixture smoke. Local Windows checks pass; they do not prove Ubuntu or a hosted runner. Completion requires green Windows/Ubuntu jobs on the same source revision. Next action: push a review branch and run CI; record URL/revision/outcome here and in [pilot](../pilot.md).
