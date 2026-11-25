import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  installWindowsVoice,
  stopWindowsVoice,
  windowsVoiceCommand,
  windowsVoiceReady,
} from './windows-voice'
import { CONFIG_DIR } from '../domain/config/config'
import {
  isRunning,
  startBackground,
  stop,
  type DaemonPaths,
  type StartResult,
  type StopResult,
} from './daemon-supervisor'

/**
 * Lifecycle (install / run / remove) for the `timmy-voice` Python daemon. Voice ships NOT as a binary
 * but as a cloned repo + `uv sync` (heavy Python + ML deps), then run via uv. Process control reuses
 * the generic {@link startBackground}/{@link stop} supervisor — voice is just another supervised daemon.
 * This is core CLI plumbing (the only CLI a user types is `timmy`); the daemon stays a black box reached
 * over the `/stream` contract.
 */
export const VOICE_REPO_URL = 'https://github.com/omatsetyadi/timmy-voice.git'
export const VOICE_DIR = join(CONFIG_DIR, 'voice')
export const VOICE_PATHS: DaemonPaths = {
  pidFile: join(CONFIG_DIR, 'voice.pid'),
  logFile: join(CONFIG_DIR, 'voice.log'),
}
// `--headless` = the hands-free wake-word loop with NO stdin — the right mode for a backgrounded
// daemon (`--voice` is push-to-talk and needs Enter/a terminal, which a detached process doesn't have).
// Reads url/keys/voice.* from the shared ~/.timmy/config.yaml.
const VOICE_RUN = { cmd: 'uv', args: ['run', 'python', '-m', 'timmy_voice', '--headless'] }
const localUv = join(homedir(), '.local', 'bin', 'uv.exe')
export const UV_COMMAND =
  process.env.UV_PATH ?? (process.platform === 'win32' && existsSync(localUv) ? localUv : 'uv')

/** Installed = the repo is cloned (pyproject.toml present in the canonical dir). */
export const isVoiceInstalled = (dir = VOICE_DIR): boolean =>
  existsSync(join(dir, 'pyproject.toml'))

/** Is a CLI tool present on PATH? (`<tool> --version` exits 0). */
const hasTool = (tool: string): boolean => {
  try {
    execFileSync(tool, ['--version'], { stdio: 'ignore', windowsHide: true, timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export interface Preflight {
  python: boolean
  uv: boolean
  git: boolean
  supported: boolean
  pythonPath?: string
}
/** What's present for a voice install. `python3` ≥ 3.11 and `uv` are required. */
export const supportsPython = (version: string): boolean => {
  const match = /^(\d+)\.(\d+)/.exec(version.trim())
  return !!match && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 11))
}

export const preflight = (): Preflight => {
  const candidates =
    process.platform === 'win32'
      ? [['py', '-3'], ['python'], ['python3']]
      : [['python3'], ['python']]
  let pythonPath: string | undefined
  for (const [command, ...args] of candidates) {
    try {
      const output = execFileSync(
        command,
        [
          ...args,
          '-c',
          'import sys; print(str(sys.version_info.major)+"."+str(sys.version_info.minor)); print(sys.executable)',
        ],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 3000,
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      )
        .trim()
        .split(/\r?\n/)
      if (!supportsPython(output[0])) continue
      pythonPath = output[1]
      break
    } catch {
      /* Try the next native launcher. */
    }
  }
  return {
    python: !!pythonPath,
    pythonPath,
    uv: hasTool(UV_COMMAND),
    git: hasTool('git'),
    supported: process.platform === 'darwin' || process.platform === 'win32',
  }
}

export type InstallResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'already-installed'
        | 'missing-python'
        | 'missing-uv'
        | 'missing-git'
        | 'unsupported-platform'
    }

/**
 * Clone timmy-voice → {@link VOICE_DIR} and `uv sync`. Returns a structured reason instead of
 * installing system Python/uv silently (we never auto-install a system toolchain). The CLI surfaces
 * the plan + the fix for each missing prereq.
 */
export const installVoice = (repair = false): InstallResult => {
  if (isVoiceInstalled() && !repair) return { ok: false, reason: 'already-installed' }
  const pre = preflight()
  if (!pre.supported) return { ok: false, reason: 'unsupported-platform' }
  if (!pre.pythonPath) return { ok: false, reason: 'missing-python' }
  if (!pre.uv) return { ok: false, reason: 'missing-uv' }
  if (process.platform === 'win32') {
    installWindowsVoice(VOICE_DIR, UV_COMMAND)
    return { ok: true }
  }
  if (!pre.git) return { ok: false, reason: 'missing-git' }
  execFileSync('git', ['clone', '--depth', '1', VOICE_REPO_URL, VOICE_DIR], { stdio: 'inherit' })
  // `--extra voice` pulls the real-audio stack (STT/TTS/wake/AEC/tray); plain `uv sync` installs only
  // the light backbone, leaving the daemon unable to actually listen or speak.
  execFileSync('uv', ['sync', '--extra', 'voice', '--python', pre.pythonPath], {
    cwd: VOICE_DIR,
    stdio: 'inherit',
    windowsHide: true,
  })
  return { ok: true }
}

/** Start the voice daemon in the background (no-op if already running; errors if not installed). */
export const startVoice = async (): Promise<
  StartResult | { notInstalled: true } | { unsupportedPlatform: true }
> => {
  if (process.platform !== 'darwin' && process.platform !== 'win32')
    return { unsupportedPlatform: true }
  if (!isVoiceInstalled()) return { notInstalled: true }
  if (process.platform === 'win32') {
    const command = windowsVoiceCommand(VOICE_DIR)
    return startBackground(VOICE_PATHS, command.cmd, command.args, {
      cwd: VOICE_DIR,
      ready: windowsVoiceReady,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
    })
  }
  return startBackground(VOICE_PATHS, VOICE_RUN.cmd, VOICE_RUN.args, { cwd: VOICE_DIR })
}

export const stopVoice = (): Promise<StopResult> =>
  process.platform === 'win32' ? stopWindowsVoice(VOICE_PATHS) : stop(VOICE_PATHS)

export interface VoiceLifecycleStatus {
  installed: boolean
  running: number | null
}
export const voiceLifecycleStatus = (): VoiceLifecycleStatus => ({
  installed: isVoiceInstalled(),
  running: isRunning(VOICE_PATHS),
})

/** Stop (if running) and remove the install dir. */
export const uninstallVoice = async (): Promise<void> => {
  await stopVoice()
  rmSync(VOICE_DIR, { recursive: true, force: true })
}
