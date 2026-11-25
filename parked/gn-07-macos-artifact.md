# GN-07.07 - hosted macOS artifact acceptance

Status: blocked, parked. Dependency: GitHub-hosted macOS arm64 runner capacity. Windows functionality is verified independently.

- [ ] GN-07.07 - Obtain a successful hosted darwin-arm64 build and version smoke on the final implementation revision.

The macos-14 runner was retired, so the workflow now requests macos-15. On revision 6c5590d, the Windows build/standalone/installer job passed but macOS was cancelled. GitHub's job annotations state: "The job was not acquired by Runner of type hosted even after multiple attempts" and report macOS arm64 capacity constraints. [Run](https://github.com/parikesitad-pm/timmy/actions/runs/45619799425), macOS job 139224589156.

Resume when runner capacity is available. Next action: rerun the artifact workflow on the final review branch and verify the macOS job; do not tag or publish a release implicitly. Keep [GN-07](../plan/gn-07-windows-release.md) and [pilot](../pilot.md) synchronized. Windows artifact success is not a claim that the entire release workflow passed.
