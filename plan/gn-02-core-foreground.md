# GN-02 - core foreground

Status: done. Dependency: [GN-01](gn-01-windows-baseline.md). Next: [GN-03](gn-03-cli-portability.md).

## Goal and scope

Prove isolated init, foreground health, provider chat, native console interaction, shutdown and history after restart. Background and packaging belong to later stages.

## Tasks

- [x] GN-02.01 - Isolate config/database/logs under TIMMY_HOME in `.timmy-pilot/`; HOME is unchanged.
- [x] GN-02.02 - Exercise interactive init with one provider and decline optional plugins.
- [x] GN-02.03 - Verify native credential-store operation, real Codex reply, and native console TUI. Console tests use Windows ConPTY rather than a visual Windows Terminal session.
- [x] GN-02.04 - Verify Ctrl+C, graceful exit, restart and persisted assistant history through the application.
- [x] GN-02.05 - Fix confirmed foreground blockers and record limits.

## Output, completion and verification

Real Codex source/binary chat passed on 24 November. The 25 November 0.2.0 standalone fixture rerun passed health/chat/history and actual ConPTY Unicode, multiline, resize, Escape cancellation and /exit. Foreground Ctrl+C produces a successful cleanup receipt and process exit. No Bash, WSL or mocked terminal is used. [Validation](validation.md) records subsequent final checks.

Handoff: GN-03 portability is verified; continue lifecycle/CI/release. Update [pilot](../pilot.md) with changes.
