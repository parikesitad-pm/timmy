import assert from 'node:assert/strict'
import console from 'node:console'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const require = createRequire(resolve('packages/core/package.json'))
const { Entry } = require('@napi-rs/keyring')
const credential = new Entry('timmy-windows-pilot', randomUUID())
const value = randomUUID()
try {
  credential.setPassword(value)
  assert.equal(credential.getPassword(), value)
} finally {
  credential.deletePassword()
}
console.log('PASS Windows native credential store write/read/delete; synthetic value not printed')
const { editorCommand } = require('./dist/infra/editor-command.js')
const editor = editorCommand('code --version')
if (editor.env?.ELECTRON_RUN_AS_NODE === '1') {
  const version = execFileSync(editor.executable, editor.args, {
    env: editor.env,
    windowsHide: true,
    timeout: 15_000,
    encoding: 'utf8',
  })
  assert.match(version, /^\d+\.\d+\.\d+(?:\r?\n|$)/)
  console.log('PASS Windows code.cmd resolution through native VS Code CLI without a shell')
}

const hfRequire = createRequire(require.resolve('@huggingface/transformers'))
const ort = hfRequire('onnxruntime-node')
const response = await globalThis.fetch(
  'https://raw.githubusercontent.com/onnx/onnx/v1.17.0/onnx/backend/test/data/node/test_identity/model.onnx',
  {
    signal: globalThis.AbortSignal.timeout(30_000),
  },
)
assert.ok(response.ok, `ONNX test model download returned ${response.status}`)
const model = new Uint8Array(await response.arrayBuffer())
const session = await ort.InferenceSession.create(model, { executionProviders: ['cpu'] })
try {
  const shape = session.inputMetadata[0].shape
  const data = Float32Array.from(
    { length: shape.reduce((product, size) => product * size, 1) },
    (_, index) => index + 1,
  )
  const result = await session.run({
    [session.inputNames[0]]: new ort.Tensor('float32', data, shape),
  })
  assert.deepEqual(Array.from(result[session.outputNames[0]].data), Array.from(data))
  console.log('PASS Windows native ONNX CPU inference with the official ONNX identity model')
} finally {
  await session.release()
}
