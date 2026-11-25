# GN-05.07 - external macOS plugin bundle

Status: planned, parked. Dependency: supported macOS host plus sibling timmy-plugin-machine bundle.

- [ ] GN-05.07 - Build/provide the external bundle and run the plugin-loader integration case on macOS.

This is the existing conditional skip, not a newly disabled test. Its AppleScript/app-control assertions do not prove Windows support. Resume when that host/bundle is available. Next action: pnpm --filter timmy-core exec vitest run src/domain/tools/plugin-loader.test.ts. Current Windows result: seven pass and one existing skip. [Stage](../plan/gn-05-optional-integrations.md), [pilot](../pilot.md).
