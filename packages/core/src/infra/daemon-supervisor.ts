import { spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { once } from 'node:events'
import { dirname } from 'node:path'
import { setTimeout } from 'node:timers/promises'

/**
 * Generic background-process supervision over a pidfile + logfile. Core has no process manager today
 * (`timmy start` is foreground); this is the first one. Kept generic so BOTH core (`timmy start`) and
 * the voice daemon (`timmy voice start`) reuse it — same pidfile/logfile/stop semantics.
 *
 * Pure-ish + dependency-injected (paths passed in) so it's unit-testable without globals.
 */
export interface DaemonPaths {
  /** e.g. ~/.timmy/timmy.pid */
  readonly pidFile: string
  /** e.g. ~/.timmy/timmy.log — child stdout+stderr are appended here */
  readonly logFile: string
}

/** Read + parse the pidfile. `null` if missing or not a positive integer. */
export const readPid = (pidFile: string): number | null => {
  if (!existsSync(pidFile)) return null
  const raw = readFileSync(pidFile, 'utf8').trim()
  const pid = Number(raw)
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

/** Is a process with this pid alive? `kill(pid, 0)` probes without signalling (EPERM still = alive). */
export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** The live pid if the daemon is running, else `null` — and clears a stale pidfile (dead pid) as a
 *  side effect, so a crashed daemon never blocks the next start. */
export const isRunning = (paths: DaemonPaths): number | null => {
  const pid = readPid(paths.pidFile)
  if (pid === null) return null
  if (isAlive(pid)) return pid
  rmSync(paths.pidFile, { force: true }) // stale — owner died without cleanup
  return null
}

export type StartResult = { started: number } | { alreadyRunning: number }

/**
 * Spawn `command args` as a **detached** background process: stdio redirected to the logfile (append),
 * pid recorded, parent free to exit (`unref`). No-op (returns `alreadyRunning`) if already up.
 */
export const startBackground = async (
  paths: DaemonPaths,
  command: string,
  args: readonly string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; ready?: (pid: number) => Promise<void> } = {},
): Promise<StartResult> => {
  mkdirSync(dirname(paths.pidFile), { recursive: true })
  const lockFile = `${paths.pidFile}.lock`
  const owner = readPid(lockFile)
  if (owner !== null && !isAlive(owner)) rmSync(lockFile, { force: true })
  const lock = openSync(lockFile, 'wx')
  try {
    writeFileSync(lock, String(process.pid))
    const running = isRunning(paths)
    if (running !== null) return { alreadyRunning: running }
    const log = openSync(paths.logFile, 'a')
    let child
    try {
      child = spawn(command, [...args], {
        detached: true,
        windowsHide: true,
        stdio: ['ignore', log, log],
        cwd: opts.cwd,
        env: opts.env ?? process.env,
      })
    } finally {
      closeSync(log)
    }
    await once(child, 'spawn')
    const pid = child.pid
    if (pid === undefined) throw new Error('Spawn completed without a process ID')
    writeFileSync(paths.pidFile, String(pid))
    child.unref()
    try {
      await opts.ready?.(pid)
    } catch (error) {
      if (isAlive(pid)) {
        child.kill()
        await waitForExit(pid)
      }
      if (readPid(paths.pidFile) === pid) rmSync(paths.pidFile, { force: true })
      throw error
    }
    return { started: pid }
  } finally {
    closeSync(lock)
    rmSync(lockFile, { force: true })
  }
}

export type StopResult = { stopped: number } | { notRunning: true }

/** Signal the running daemon (default SIGTERM) and remove the pidfile. */
export async function waitForExit(pid: number, timeout = 5000): Promise<void> {
  const deadline = Date.now() + timeout
  while (isAlive(pid)) {
    if (Date.now() >= deadline) throw new Error(`Process ${pid} did not exit within ${timeout}ms`)
    await setTimeout(50)
  }
}

export const stop = async (
  paths: DaemonPaths,
  signal: NodeJS.Signals = 'SIGTERM',
): Promise<StopResult> => {
  const pid = isRunning(paths)
  if (pid === null) return { notRunning: true }
  try {
    process.kill(pid, signal)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
  }
  await waitForExit(pid)
  rmSync(paths.pidFile, { force: true })
  return { stopped: pid }
}
