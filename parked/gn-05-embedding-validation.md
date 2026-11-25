# GN-05.03 / GN-07.02 - full embedding and standalone native loading

Status: planned, parked. Dependencies: [GN-05](../plan/gn-05-optional-integrations.md), [GN-07](../plan/gn-07-windows-release.md).

- [ ] GN-05.03 - Download/load the configured sentence-transformer and verify a nonempty text embedding on Windows.
- [ ] GN-07.02 - Verify actual ONNX native module/DLL loading and text inference from the standalone executable; document or fix packaging if unavailable.

Verified: native Node ONNX CPU identity inference, credential-store roundtrip, keyword recall when embeddings are unavailable, standalone text chat/SQLite/TUI. These do not prove a sentence-model pipeline or embedded ONNX loading. Parked optional model validation; no full-model support claim. Resume with model files and the target standalone runtime available. Next action: run a real embedding probe and inspect native-loading errors without swallowing them. Use models.embedding: none for verified keyword-only operation. Update both stages and [pilot](../pilot.md).
