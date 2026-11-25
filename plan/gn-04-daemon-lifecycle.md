# GN-04 - daemon lifecycle

Status: in-progress; implementation verified, actual login acceptance parked. Dependency: [GN-03](gn-03-cli-portability.md). Handoff: [GN-05](gn-05-optional-integrations.md).

## Goal and scope

Native background readiness, authenticated control, graceful shutdown and current-user Task Scheduler. Packaging is GN-07.

## Tasks

- [x] GN-04.01 - Handle spawn errors, windowsHide, parent log-handle closure, startup lock, PID ownership and authenticated readiness.
- [x] GN-04.02 - Implement random-token local control; Windows named pipe and short mode-600 Unix socket call the shared shutdown path.
- [x] GN-04.03 - Wait for exit and matching successful cleanup receipt; explicit force mode reports its limitation.
- [x] GN-04.04 - Stop only a voice process started by core, interrupt provider streams, close HTTP/WebSocket transport and dispose SQLite/runtime. The GN-09 Windows backend now has actual core-owned voice startup, authenticated graceful stop, mic/SAPI cleanup and repeated restart evidence. Login-trigger acceptance stays separate.
- [x] GN-04.05 - Register per-profile current-user Limited/Interactive tasks using absolute paths, saved cwd, safe argument quoting and hidden PowerShell.
- [ ] GN-04.06 - Automated start/repeated-start/status/stop/repeated-stop/restart/occupied-port/missing-exe/readiness-failure and scheduled task on/off/status/explicit launch pass. [Actual sign-in acceptance remains parked](../parked/gn-04-login-acceptance.md).

## Output, completion and verification

Final standalone smoke passes actual process exit, cleanup receipt, busy-stream cancellation and native console Ctrl+C. A discovered HTTP request cancellation leak was fixed with scoped AbortControllers and regression coverage. Earlier actual Task Scheduler testing passed registration, repeated on/off, explicit task launch from a spaced cwd, health and graceful stop; its task was removed. Different profiles have independent task names/control records.

Completion requires the real-login part of GN-04.06; do not mark the whole stage done from explicit task launch. Next: user-controlled login acceptance; independent integration/CI/release work continues. [Pilot](../pilot.md), [validation](validation.md).
