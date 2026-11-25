# GN-07.06 - draft PR quality review

Status: planned, parked for release review. Dependency: [draft PR #1](https://github.com/parikesitad-pm/timmy/pull/1), current SonarCloud analysis and reviewer decisions. Core Windows/Ubuntu CI and Windows executable tests are tracked separately.

- [ ] GN-07.06 - Resolve the remaining duplication gate and review concrete security hotspots before treating the PR as merge-ready.

Analysis of revision 6c5590d reports 3.4% duplication on new code (gate <=3%) and a C security rating. The concrete HTTP finding was a configurable non-loopback HTTP voice endpoint; the subsequent fix restricts it to explicit IPv4/IPv6/localhost loopback URLs and validates numeric ports, with a regression test against remote hosts and port-based URL redirection. Final reanalysis is pending.

Other review annotations concern trusted user PATH tools, building this repository's local Python package during locked dependency installation, a newly added action tag, and a false "no tests" report on a file using it.effect. Actual Vitest execution passes that file's tests. pip's uv bootstrap is now restricted to wheels. No scanner exclusions, NOSONAR markers, or gate relaxations were added.

Resume for release/merge review. Next action: read the post-fix analysis, distinguish actual defects from review hotspots, refactor genuine duplication without removing assertions, and verify the gate. Do not report this gate as green merely because runtime tests pass. [Analysis](https://sonarcloud.io/dashboard?id=parikesitad-pm_timmy&pullRequest=1), [GN-07](../plan/gn-07-windows-release.md), [pilot](../pilot.md).

Post-fix analysis of 7406534 still reports 3.3% duplication and a C security rating. The loopback restriction and remote/port-redirection tests are present, but the external gate remains unresolved and is not claimed green. Next reviewer action remains exact finding triage and duplication cleanup; no exclusions or rating overrides were applied.
