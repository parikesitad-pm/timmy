import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { CONFIG_DIR } from '../domain/config/config'
import type { PlistSpec } from './autostart'

export const windowsTaskName = (label: string): string =>
  `${label}-${createHash('sha256').update(CONFIG_DIR).digest('hex').slice(0, 12)}`

export const quoteWindowsArgument = (value: string): string =>
  !value || /[\s"]/.test(value)
    ? `"${value.replace(/(\\*)"/g, (_, slashes: string) => `${slashes}${slashes}\\"`).replace(/(\\+)$/g, '$1$1')}"`
    : value

const psQuote = (value: string): string => `'${value.replaceAll("'", "''")}'`

export function windowsAutostart(
  operation: 'enable' | 'disable' | 'status',
  label: string,
  spec?: PlistSpec,
): boolean {
  const executable = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  )
  const launch = spec
    ? [
        `$env:TIMMY_HOME=${psQuote(CONFIG_DIR)}`,
        `Set-Location -LiteralPath ${psQuote(process.cwd())}`,
        `& ${spec.programArgs.map(psQuote).join(' ')}`,
        'exit $LASTEXITCODE',
      ].join('; ')
    : ''
  const argumentsText = [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-Command',
    launch,
  ]
    .map(quoteWindowsArgument)
    .join(' ')
  const query =
    '$task=Get-ScheduledTask -TaskPath ([string][char]92) -ErrorAction Stop | Where-Object { $_.TaskName -eq $spec.name }; '
  const commands = {
    status: query + "if($null -eq $task -or $task.State -eq 'Disabled'){exit 3}",
    disable:
      query + 'if($null -ne $task){Unregister-ScheduledTask -TaskName $spec.name -Confirm:$false}',
    enable: `$user=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action=New-ScheduledTaskAction -Execute $spec.executable -Argument $spec.arguments -WorkingDirectory $spec.cwd
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $spec.name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Timmy personal assistant, current-user login' -Force | Out-Null`,
  }
  try {
    execFileSync(
      executable,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$ErrorActionPreference='Stop'; $spec=$env:TIMMY_TASK_SPEC | ConvertFrom-Json; ${commands[operation]}; exit 0`,
      ],
      {
        windowsHide: true,
        stdio: 'pipe',
        timeout: 30_000,
        env: {
          ...process.env,
          TIMMY_TASK_SPEC: JSON.stringify({
            name: windowsTaskName(label),
            executable,
            arguments: argumentsText,
            cwd: process.cwd(),
          }),
        },
      },
    )
    return true
  } catch (error) {
    if (operation === 'status' && (error as { status?: number }).status === 3) return false
    throw error
  }
}
