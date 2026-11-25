import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { CONFIG_DIR } from '../domain/config/config'
import { isAlive, isRunning, readPid, waitForExit, type DaemonPaths } from './daemon-supervisor'
import { setTimeout } from 'node:timers/promises'

declare const TIMMY_WINDOWS_VOICE_FILES: Record<string, string>

export function windowsVoiceCommand(directory: string) {
  const cmd = execFileSync(
    join(directory, '.venv', 'Scripts', 'python.exe'),
    ['-c', 'import sys; print(sys._base_executable)'],
    { encoding: 'utf8', windowsHide: true, timeout: 5000 },
  ).trim()
  // Windows' venv launcher creates a second process. Launch the real interpreter so PID ownership
  // and authenticated readiness refer to the same process; load this venv's installed packages.
  return {
    cmd,
    args: [
      '-I',
      '-c',
      'import site,sys,runpy; site.addsitedir(sys.argv[1]); sys.argv=["timmy_voice_windows","--headless"]; runpy.run_module("timmy_voice_windows",run_name="__main__")',
      join(directory, '.venv', 'Lib', 'site-packages'),
    ],
  }
}

export function installWindowsVoice(directory: string, uv: string): void {
  const source = resolve(__dirname, '../../../modules/voice')
  const names = ['pyproject.toml', 'uv.lock', 'README.md']
  const modulePath = 'src/timmy_voice_windows'
  const files =
    typeof TIMMY_WINDOWS_VOICE_FILES !== 'undefined'
      ? TIMMY_WINDOWS_VOICE_FILES
      : Object.fromEntries(
          [
            ...names,
            ...readdirSync(join(source, modulePath))
              .filter((name) => name.endsWith('.py'))
              .map((name) => `${modulePath}/${name}`),
          ].map((name) => [name, readFileSync(join(source, name), 'utf8')]),
        )
  for (const [name, content] of Object.entries(files)) {
    const target = join(directory, name)
    mkdirSync(resolve(target, '..'), { recursive: true })
    writeFileSync(target, content)
  }
  execFileSync(uv, ['sync', '--frozen', '--no-dev', '--python', '3.12'], {
    cwd: directory,
    stdio: 'inherit',
    windowsHide: true,
  })
  execFileSync(
    join(directory, '.venv', 'Scripts', 'python.exe'),
    ['-m', 'timmy_voice_windows', 'download'],
    {
      cwd: directory,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
    },
  )
}

function voiceControl() {
  const path = join(CONFIG_DIR, 'voice', 'control.json')
  if (!existsSync(path)) return null
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as {
      pid: number
      port: number
      token: string
    }
    return Number.isSafeInteger(value.pid) &&
      Number.isInteger(value.port) &&
      value.port > 0 &&
      value.port < 65536 &&
      typeof value.token === 'string'
      ? value
      : null
  } catch {
    return null
  }
}

async function control(command: 'health' | 'stop', pid: number): Promise<void> {
  const record = voiceControl()
  if (record?.pid !== pid) throw new Error('No matching Windows voice control record')
  const response = await fetch(`http://127.0.0.1:${record.port}/${command}`, {
    method: command === 'stop' ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${record.token}` },
    signal: AbortSignal.timeout(3000),
  })
  if (!response.ok || ((await response.json()) as { pid: number }).pid !== pid)
    throw new Error('Windows voice control rejected the request')
}

export async function windowsVoiceReady(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 1800; attempt++) {
    if (!isAlive(pid)) throw new Error('Voice exited before readiness; inspect timmy voice logs')
    if (voiceControl()?.pid === pid) return control('health', pid)
    await setTimeout(100)
  }
  throw new Error('Voice readiness timed out; inspect timmy voice logs')
}

export async function stopWindowsVoice(paths: DaemonPaths) {
  const pid = isRunning(paths)
  if (pid === null) return { notRunning: true } as const
  await control('stop', pid)
  await waitForExit(pid, 10_000)
  if (readPid(paths.pidFile) === pid) rmSync(paths.pidFile, { force: true })
  return { stopped: pid }
}
