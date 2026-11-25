$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pilotRoot = Join-Path $repoRoot '.timmy-pilot'
$fixtureRoot = Join-Path $pilotRoot ('installer ' + [Guid]::NewGuid().ToString('N'))
if (-not $fixtureRoot.StartsWith($pilotRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture escaped pilot directory.' }
$targetDir = Join-Path $fixtureRoot 'installed app with spaces'
$badSource = Join-Path $fixtureRoot 'bad source'
$sourceDir = Join-Path $repoRoot 'release'
$installer = Join-Path $PSScriptRoot 'install-windows.ps1'
$env:TIMMY_HOME = Join-Path $fixtureRoot 'profile'
$beforePath = [Environment]::GetEnvironmentVariable('Path', 'User')
New-Item -ItemType Directory -Path $env:TIMMY_HOME -Force | Out-Null
$profileMarker = Join-Path $env:TIMMY_HOME 'preserve.txt'
Set-Content -LiteralPath $profileMarker -Value 'preserve user data'
try {
  $null = & $installer -SourceDirectory $sourceDir -InstallDirectory $targetDir -NoPathUpdate
  $exe = Join-Path $targetDir 'timmy.exe'
  if ((& $exe version) -notmatch 'Timmy v') { throw 'Installed binary failed.' }
  $originalHash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
  $null = & $installer -SourceDirectory $sourceDir -InstallDirectory $targetDir -NoPathUpdate
  New-Item -ItemType Directory -Path $badSource | Out-Null
  Copy-Item -LiteralPath (Join-Path $sourceDir 'timmy-windows-x64.exe') -Destination $badSource
  Set-Content -LiteralPath (Join-Path $badSource 'SHA256SUMS') -Value (('0' * 64) + '  timmy-windows-x64.exe')
  try {
    $null = & $installer -SourceDirectory $badSource -InstallDirectory $targetDir -NoPathUpdate
    throw 'Installer accepted a corrupted checksum.'
  } catch { if ($_.Exception.Message -notmatch 'Checksum mismatch') { throw } }
  if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ne $originalHash) { throw 'Failed update changed the installed binary.' }
  Set-Content -LiteralPath (Join-Path $targetDir 'keep.txt') -Value 'unrelated file'
  $null = & $installer -InstallDirectory $targetDir -Uninstall -NoPathUpdate
  if (Test-Path -LiteralPath $exe) { throw 'Uninstall left the executable.' }
  if (-not (Test-Path -LiteralPath (Join-Path $targetDir 'keep.txt'))) { throw 'Uninstall removed unrelated files.' }
  if (-not (Test-Path -LiteralPath $profileMarker)) { throw 'Uninstall removed profile data.' }
  if ([Environment]::GetEnvironmentVariable('Path', 'User') -ne $beforePath) { throw 'NoPathUpdate changed user PATH.' }
  Write-Output 'PASS installer checksum, install/update with spaces, rejected mismatch, uninstall, profile preservation and unrelated-file preservation'
} finally {
  if (Test-Path -LiteralPath $fixtureRoot) { Remove-Item -LiteralPath $fixtureRoot -Recurse -Force }
}
