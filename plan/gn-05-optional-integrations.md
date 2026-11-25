# GN-05 - optional integrations

Status: in-progress; verified matrix below, unsupported/external checks parked. Dependency: [GN-04](gn-04-daemon-lifecycle.md) implementation. Next: [GN-06](gn-06-windows-ci.md).

## Goal and scope

Test Codex, credential storage, embeddings and voice independently. Optional failures must preserve text chat.

## Tasks

- [x] GN-05.01 - Replace Claude Agent SDK with exact Codex SDK 0.171.0; use native codex.exe/CODEX_PATH, existing CLI auth, lazy ESM loading, signal cancellation and default-model configuration. Never execute SDK-reported completed actions a second time.
- [x] GN-05.02 - Native Windows credential store synthetic write/read/delete passes; values are not printed and the entry is removed.
- [ ] GN-05.03 - Keyword fallback and native ONNX identity CPU inference pass. [Full sentence-model and standalone ONNX checks remain parked](../parked/gn-05-embedding-validation.md).
- [x] GN-05.04 - Resolve Windows Python candidates and version >=3.11, git/uv; use the selected Python explicitly on supported installations.
- [ ] GN-05.05 - Upstream audit identified its missing Windows backend; GN-09 now supplies a local half-duplex implementation with native microphone/model/lifecycle tests and a confirmed live spoken reply. [Resumed acceptance record](../parked/gn-05-windows-voice.md).
- [x] GN-05.06 - Record separate supported/unsupported/untested results rather than inferring everything from chat.
- [ ] GN-05.07 - [Existing skipped macOS external bundle test](../parked/gn-05-machine-plugin.md).

## Compatibility matrix and verification

| Feature                                               | Windows result                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Native Codex SDK/CLI auth and actual model chat       | Verified in Node and standalone executable                                                                |
| Credential-store read/write/delete                    | Verified under Node with synthetic value; standalone provider boot exercises reads                        |
| Keyword memory fallback / disabled embedding          | Verified tests and standalone text chat                                                                   |
| Native Node ONNX CPU identity inference               | Verified separately                                                                                       |
| Full sentence-transformer inference / standalone ONNX | Untested; GN-05.03/GN-07.02 parked                                                                        |
| Voice audio                                           | Local Windows backend implemented; live wake/reply confirmed in GN-09; final cue/packaging checks pending |
| Optional absent/unsupported integrations              | Core text chat and health remain available                                                                |

Output: reproducible capability script, provider tests, explicit platform errors and this matrix. Completion still needs the pending tasks or an explicitly revised scope. Next: CI/release verification can proceed with the documented optional limitations. [Pilot](../pilot.md), [validation](validation.md).
