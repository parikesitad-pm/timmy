import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, dirname, resolve } from 'node:path'

export function editorCommand(
  value?: string,
  platform = process.platform,
): { executable: string; args: string[]; env?: NodeJS.ProcessEnv } {
  const command = value?.trim() || (platform === 'win32' ? 'notepad.exe' : 'vi')
  const pattern = /"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s"']+)/g
  const direct = existsSync(command)
  const tokens = direct
    ? [command]
    : [...command.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3])
  if ((!direct && command.replace(pattern, '').trim()) || !tokens[0])
    throw new Error('Invalid editor command quoting')
  const launch = { executable: tokens[0], args: tokens.slice(1) }
  if (platform !== 'win32' || !/^code(?:\.cmd)?$/i.test(basename(tokens[0]))) return launch
  let shim = existsSync(tokens[0]) ? tokens[0] : undefined
  if (!shim) {
    try {
      shim = execFileSync('where.exe', ['code.cmd'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .split(/\r?\n/)[0]
    } catch {
      return launch
    }
  }
  const paths = /"%~dp0([^"\r\n]*Code\.exe)"\s+"%~dp0([^"\r\n]*cli\.js)"/i.exec(
    readFileSync(shim, 'utf8'),
  )
  if (!paths) throw new Error('Unrecognized VS Code shim; set EDITOR to a native executable')
  const native = resolve(dirname(shim), paths[1])
  const cli = resolve(dirname(shim), paths[2])
  if (!existsSync(native) || !existsSync(cli))
    throw new Error('VS Code native executable or CLI entry is missing')
  const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  delete env.VSCODE_DEV
  return { executable: native, args: [cli, ...launch.args], env }
}
