# Codex SDK Windows process patch

SDK 0.171.0 does not pass `windowsHide` when spawning its native CLI. A detached Windows voice turn therefore opens a console window. The tracked pnpm patch adds `windowsHide: true`; arguments, authentication, streaming, signals and sandbox settings are unchanged.

The frozen lockfile records the patch hash. Reassess this patch when upgrading the SDK; remove it once upstream provides equivalent hidden-process behavior.
