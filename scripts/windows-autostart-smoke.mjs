import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import console from 'node:console'
import { once } from 'node:events'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve, join } from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'

assert.equal(process.platform, 'win32', 'This check requires Windows Task Scheduler')
const entry = resolve('packages/core/dist/index.js')
const home = resolve('.timmy-pilot', `autostart ${Date.now()}`)
mkdirSync(home, { recursive: true })
process.env.TIMMY_HOME = home
const { windowsTaskName } = await import('../packages/core/dist/infra/windows-autostart.js')
const taskName = windowsTaskName('com.timmy.core')
const reservation = createServer().listen(0, '127.0.0.1')
await once(reservation, 'listening')
const port = reservation.address().port
await new Promise((resolve) => reservation.close(resolve))
writeFileSync(
  join(home, 'config.yaml'),
  JSON.stringify({
    server: { host: '127.0.0.1', port, auth: { enabled: false } },
    models: { frontdesk: { provider: 'codex', model: 'default' }, embedding: 'none' },
    providers: { codex: { kind: 'codex' } },
    memory: { learning_mode: false },
  }),
)
const work = join(home, 'working directory with spaces')
mkdirSync(work)
process.chdir(work)

async function cli(args) {
  const child = spawn(process.execPath, [entry, ...args], { env: process.env, windowsHide: true })
  let output = ''
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => {
      output += data
    })
  const [code] = await once(child, 'exit', { signal: globalThis.AbortSignal.timeout(40_000) })
  assert.equal(code, 0, output)
  return output
}

try {
  assert.match(await cli(['autostart', 'on']), /enabled/)
  await cli(['autostart', 'on'])
  assert.match(await cli(['autostart', 'status']), /Autostart: on/)
  const powershell = join(
    process.env.SystemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  )
  execFileSync(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference='Stop'; $task=Get-ScheduledTask -TaskName $env:TIMMY_TEST_TASK; if($task.Principal.RunLevel -ne 'Limited'){throw 'Unexpected run level'}; Start-ScheduledTask -TaskName $env:TIMMY_TEST_TASK",
    ],
    { windowsHide: true, env: { ...process.env, TIMMY_TEST_TASK: taskName } },
  )
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await globalThis.fetch(`http://127.0.0.1:${port}/health`)).ok) {
        ready = true
        break
      }
    } catch {
      /* Task Scheduler has not launched the action yet. */
    }
    await setTimeout(100)
  }
  assert.ok(ready, 'Scheduled task did not make its isolated profile healthy')
  assert.match(await cli(['stop']), /graceful cleanup/)
  await cli(['autostart', 'off'])
  await cli(['autostart', 'off'])
  assert.match(await cli(['autostart', 'status']), /Autostart: off/)
  console.log(
    'PASS per-user Limited/Interactive Task Scheduler registration, repeated on/off, task launch, spaced working directory, health and graceful stop',
  )
  console.log('NOTE an actual sign-out/sign-in has not been performed')
} finally {
  await cli(['stop'])
  await cli(['autostart', 'off'])
}
