# GN-03 - CLI portability

Status: done. Dependency: [GN-02](gn-02-core-foreground.md). Next: [GN-04](gn-04-daemon-lifecycle.md).

## Goal and scope

Replace Unix assumptions in logs, editor, image paths and default plugin recommendations. Daemon lifecycle is a separate stage.

## Tasks

- [x] GN-03.01 - Replace tail with a bounded UTF-8 log follower. Creation, append, truncation, rotation, spaces and cancellation are tested.
- [x] GN-03.02 - Filter plugin recommendations by platform; Windows recommends web/shell and macOS retains machine.
- [x] GN-03.03 - Parse editor arguments; default to notepad.exe; resolve the standard code.cmd shim to native Code.exe/cli.js with its required environment and shell disabled. Disposable profile editing and the actual installed VS Code CLI pass.
- [x] GN-03.04 - Handle drive, UNC, quoted/spaced and POSIX image paths, excluding URLs.
- [x] GN-03.05 - Preserve file-URL/platform mapping; plugin fixtures with spaces pass. The external macOS bundle skip is tracked as GN-05.07.
- [x] GN-03.06 - Verify built CLI logs -f UTF-8 output and Ctrl+C; rerun foreground chat.

## Output, completion and verification

Windows parser/plugin/editor/log tests pass. Native console log-follow and profile edit also pass in the final 0.2.0 standalone smoke with Node absent from PATH. Foreground chat and restart regressions pass. [Previously parked tasks](../parked/gn-03-cli-portability-remaining.md) are resumed and completed.

Handoff: lifecycle and release verification; [pilot](../pilot.md), [validation](validation.md).
