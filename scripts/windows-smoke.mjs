import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import console from 'node:console'
import { once } from 'node:events'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { createServer as createHttpServer } from 'node:http'
import { resolve, join } from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'

const { load, dump } = createRequire(resolve('packages/core/package.json'))('js-yaml')
const home = resolve('.timmy-pilot', `foreground ${Date.now()}`)
const env = { ...process.env, TIMMY_HOME: home }
env.EDITOR = `"${process.execPath}" -e "require('node:fs').writeFileSync(process.argv[1], 'Edited Windows fixture')"`
const fixture = process.argv.includes('--fixture')
const entry = resolve('packages/core/dist/index.js')
const executable = process.env.TIMMY_EXECUTABLE || process.execPath
const prefix = process.env.TIMMY_EXECUTABLE ? [] : [entry]
const consoleScript = resolve('scripts/windows-console-smoke.py')
if (process.env.TIMMY_NO_NODE_PATH === '1') {
  assert.ok(process.env.TIMMY_EXECUTABLE, 'No-Node verification requires the standalone executable')
  if (!fixture) {
    const located = spawnSync('where.exe', ['codex.exe'], { encoding: 'utf8', windowsHide: true })
    assert.equal(located.status, 0, 'A native Codex CLI is required for the real provider smoke')
    env.CODEX_PATH = located.stdout.trim().split(/\r?\n/)[0]
  }
  env.PATH = `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`
  env.Path = env.PATH
}
mkdirSync(home, { recursive: true })
if (process.platform === 'win32') {
  const editor = join(home, 'editor fixture.ps1')
  writeFileSync(
    editor,
    "param([string]$FixturePath)\n[IO.File]::WriteAllText($FixturePath, 'Edited Windows fixture')\n",
  )
  env.EDITOR = `"${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -File "${editor}"`
}
if (process.env.TIMMY_NO_NODE_PATH === '1') {
  assert.equal(
    spawnSync('node.exe', ['--version'], { env, windowsHide: true }).error?.code,
    'ENOENT',
  )
  console.log('PASS child environment has no Node executable on PATH')
}

let modelServer
let modelBase
if (fixture) {
  modelServer = createHttpServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.once('end', () => {
      if (request.url.endsWith('/models')) {
        response.setHeader('content-type', 'application/json')
        return response.end(JSON.stringify({ data: [{ id: 'fixture-model' }] }))
      }
      response.setHeader('content-type', 'text/event-stream')
      if (body.includes('TIMMY_HOLD')) {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'WAITING_FOR_CANCEL' } }] })}\n\n`,
        )
        return
      }
      response.end(
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'TIMMY_WINDOWS_OK' } }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
      )
    })
  }).listen(0, '127.0.0.1')
  await once(modelServer, 'listening')
  modelBase = `http://127.0.0.1:${modelServer.address().port}/v1`
}

function launch(args) {
  const child = spawn(executable, [...prefix, ...args], { env, windowsHide: true })
  child.output = ''
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => {
      child.output = (child.output + data).slice(-12_000)
    })
  return child
}

async function healthy(child, base) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Daemon exited: ${child.output}`)
    try {
      const response = await globalThis.fetch(`${base}/health`, {
        signal: globalThis.AbortSignal.timeout(500),
      })
      if (response.ok) return
    } catch {
      /* listener is not ready yet */
    }
    await setTimeout(100)
  }
  throw new Error(`Daemon readiness timeout: ${child.output}`)
}

async function terminateFixture(child) {
  if (!child || child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill()
  await exited
}

async function command(args, expected = 0) {
  const child = launch(args)
  try {
    const [code] = await once(child, 'exit', { signal: globalThis.AbortSignal.timeout(20_000) })
    assert.equal(code, expected, child.output)
    return child.output
  } finally {
    await terminateFixture(child)
  }
}

async function stopGracefully(child) {
  const exited = once(child, 'exit')
  await command(['stop'])
  const [code] = await exited
  assert.equal(code, 0, child.output)
}

async function consoleCheck(mode, args) {
  const located = spawnSync('where.exe', ['python.exe'], { encoding: 'utf8', windowsHide: true })
  assert.equal(
    located.status,
    0,
    'Python is required only for the native console verification harness',
  )
  const python = located.stdout.trim().split(/\r?\n/)[0]
  const child = spawn(
    python,
    [consoleScript, '--mode', mode, '--', executable, ...prefix, ...args],
    { env: { ...env, CI: 'false', CONTINUOUS_INTEGRATION: 'false' }, windowsHide: true },
  )
  let output = ''
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => {
      output += data
    })
  try {
    const [code] = await once(child, 'exit', { signal: globalThis.AbortSignal.timeout(90_000) })
    assert.equal(code, 0, output)
    console.log(output.trim())
  } finally {
    await terminateFixture(child)
  }
}

let daemon
try {
  const init = launch(['init'])
  const answers = new Map([
    ['Choose: ', fixture ? 'c\n' : '1\n'],
    ['Cloud provider (deepseek/openai/anthropic/gemini): ', 'fixture\n'],
    ['Model id for fixture (e.g. deepseek-v4-flash): ', 'fixture-model\n'],
    ['API key (Enter to skip for now): ', '\n'],
    ['OpenAI API key (Enter to skip): ', '\n'],
    ['Provider name (Enter to finish): ', '\n'],
    ['Install them now?', 'n\n'],
  ])
  init.stdout.on('data', () => {
    for (const [prompt, answer] of answers)
      if (init.output.includes(prompt)) {
        answers.delete(prompt)
        init.stdin.write(answer)
      }
  })
  try {
    const [code] = await once(init, 'exit', { signal: globalThis.AbortSignal.timeout(30_000) })
    assert.equal(code, 0, init.output)
  } finally {
    await terminateFixture(init)
  }
  const configPath = join(home, 'config.yaml')
  const config = load(readFileSync(configPath, 'utf8'))
  assert.equal(config.models.frontdesk.provider, fixture ? 'fixture' : 'codex')
  if (fixture) {
    config.providers = { fixture: { kind: 'openai-compat', base_url: modelBase } }
  }
  const reservation = createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise((done) => reservation.close(done))
  config.server = { host: '127.0.0.1', port, auth: { enabled: false, token: 'keychain' } }
  config.models.embedding = 'none'
  config.memory = { learning_mode: false }
  if (process.platform !== 'darwin') {
    config.voice = { autostart: true }
    if (process.platform !== 'win32') {
      mkdirSync(join(home, 'voice'))
      writeFileSync(
        join(home, 'voice', 'pyproject.toml'),
        '[project]\nname="unsupported-platform-fixture"\n',
      )
    }
  }
  writeFileSync(configPath, dump(config))
  await command(['profile', 'edit', 'assistant', 'name'])
  if (!fixture) await command(['model', 'use', 'codex/default'])
  assert.equal(load(readFileSync(configPath, 'utf8')).assistant.name, 'Edited Windows fixture')
  console.log('PASS editor executable/arguments, saved profile value and temporary-file cleanup')
  console.log(
    `PASS isolated init: ${fixture ? 'local provider fixture' : 'codex/default'}, optional plugins declined`,
  )
  const base = `http://127.0.0.1:${port}`
  daemon = launch(['start', '--foreground'])
  await healthy(daemon, base)
  console.log('PASS foreground health')
  const response = await globalThis.fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Reply with exactly TIMMY_WINDOWS_OK. Do not use tools or inspect any files.',
    }),
    signal: globalThis.AbortSignal.timeout(90_000),
  })
  assert.equal(response.status, 200)
  const frames = (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const text = frames
    .filter((frame) => frame.type === 'content')
    .map((frame) => frame.content)
    .join('')
  assert.match(text, /TIMMY_WINDOWS_OK/, JSON.stringify(frames))
  const id = frames.find((frame) => frame.thread_id)?.thread_id
  assert.ok(id)
  console.log(
    fixture ? 'PASS local provider fixture response' : 'PASS actual Codex provider response',
  )
  if (process.env.TIMMY_TEST_CONSOLE === '1') await consoleCheck('chat', ['chat'])
  await stopGracefully(daemon)
  daemon = launch(['start', '--foreground'])
  await healthy(daemon, base)
  const history = await (await globalThis.fetch(`${base}/threads/${id}`)).json()
  assert.ok(
    history.messages.some(
      (message) => message.role === 'assistant' && message.content.includes('TIMMY_WINDOWS_OK'),
    ),
  )
  console.log('PASS persisted assistant history after foreground restart')
  await stopGracefully(daemon)
  daemon = undefined
  console.log('PASS foreground graceful stop and successful cleanup receipt')
  assert.match(await command(['start']), /started in the background/)
  assert.match(await command(['start']), /already running/)
  assert.match(await command(['status']), /Timmy is up/)
  if (process.platform !== 'darwin') await command(['voice', 'start'], 1)
  if (process.env.TIMMY_TEST_CONSOLE === '1') {
    writeFileSync(join(home, 'timmy.log'), 'TIMMY_LOG_CREATED café\n', { flag: 'a' })
    await consoleCheck('logs', ['logs', '-f'])
  }
  if (fixture) {
    const pending = await globalThis.fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'TIMMY_HOLD' }),
      signal: globalThis.AbortSignal.timeout(20_000),
    })
    const reader = pending.body.getReader()
    const decoder = new globalThis.TextDecoder()
    let text = ''
    while (!text.includes('WAITING_FOR_CANCEL')) {
      const chunk = await reader.read()
      assert.ok(!chunk.done, 'Fixture stopped streaming before cancellation')
      text += decoder.decode(chunk.value)
    }
    assert.match(await command(['stop']), /graceful cleanup/)
    await reader.cancel()
    console.log('PASS graceful stop during an active streamed provider response')
  } else {
    assert.match(await command(['stop']), /graceful cleanup/)
  }
  assert.match(await command(['stop']), /not running/)
  await command(['status'], 1)
  console.log('PASS background start, repeated start, status, stop, repeated stop and exit')
  const occupied = createServer().listen(port, '127.0.0.1')
  await once(occupied, 'listening')
  try {
    await command(['start'], 1)
  } finally {
    await new Promise((done) => occupied.close(done))
  }
  console.log('PASS occupied-port startup failure')
  if (process.env.TIMMY_TEST_CONSOLE === '1')
    await consoleCheck('signal', ['start', '--foreground'])
  console.log(`Fixture: ${home}`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (existsSync(join(home, 'control.json'))) {
    try {
      await command(['stop'])
    } catch (error) {
      console.error('Fixture daemon cleanup failed:', error.message)
      process.exitCode = 1
    }
  }
  await terminateFixture(daemon)
  if (modelServer) await new Promise((done) => modelServer.close(done))
}
