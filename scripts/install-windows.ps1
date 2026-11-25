param(
  [string]$SourceDirectory,
  [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\Timmy'),
  [switch]$Uninstall,
  [switch]$NoPathUpdate
)

$ErrorActionPreference = 'Stop'
$targetDir = [IO.Path]::GetFullPath($InstallDirectory)
if ($targetDir.TrimEnd('\') -eq [IO.Path]::GetPathRoot($targetDir).TrimEnd('\')) { throw 'Choose an application directory, not a drive root.' }
$installedExe = Join-Path $targetDir 'timmy.exe'
$manifestPath = Join-Path $targetDir 'install.json'
$managed = $false
if (Test-Path -LiteralPath $manifestPath) {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $managed = $manifest.application -eq 'timmy'
}

function Update-UserPath([bool]$Add) {
  if ($NoPathUpdate) { return }
  $oldPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $segments = @($oldPath -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ine $targetDir.TrimEnd('\') })
  if ($Add) { $segments += $targetDir }
  [Environment]::SetEnvironmentVariable('Path', ($segments -join ';'), 'User')
}

if ($Uninstall) {
  if (-not $managed) { throw 'No managed Timmy installation found; nothing was removed.' }
  if (Test-Path -LiteralPath $installedExe) {
    & $installedExe stop
    if ($LASTEXITCODE -ne 0) { throw 'Stop Timmy successfully before uninstalling.' }
    Remove-Item -LiteralPath $installedExe
  }
  Remove-Item -LiteralPath $manifestPath
  Update-UserPath $false
  if (@(Get-ChildItem -LiteralPath $targetDir -Force).Count -eq 0) { Remove-Item -LiteralPath $targetDir }
  Write-Output 'Timmy uninstalled. Application profiles and history were preserved.'
  return
}

if (-not $SourceDirectory) {
  $SourceDirectory = $PSScriptRoot
  if (-not (Test-Path -LiteralPath (Join-Path $SourceDirectory 'timmy-windows-x64.exe'))) {
    $SourceDirectory = Join-Path $PSScriptRoot '..\release'
  }
}
$sourceExe = Join-Path ([IO.Path]::GetFullPath($SourceDirectory)) 'timmy-windows-x64.exe'
$sumPath = Join-Path $SourceDirectory 'SHA256SUMS'
$sum = Get-Content -LiteralPath $sumPath | Where-Object { $_ -match '^([a-fA-F0-9]{64})\s+\*?timmy-windows-x64\.exe$' }
if (@($sum).Count -ne 1) { throw 'SHA256SUMS must contain exactly one Windows executable checksum.' }
$expected = ($sum -split '\s+')[0]
if ((Get-FileHash -LiteralPath $sourceExe -Algorithm SHA256).Hash -ine $expected) { throw 'Checksum mismatch; installation was not changed.' }
& $sourceExe version
if ($LASTEXITCODE -ne 0) { throw 'The source executable failed its version check.' }
if ((Test-Path -LiteralPath $installedExe) -and -not $managed) { throw 'Refusing to overwrite an unmanaged timmy.exe.' }
if ($managed -and (Test-Path -LiteralPath $installedExe)) {
  & $installedExe stop
  if ($LASTEXITCODE -ne 0) { throw 'Stop Timmy successfully before updating.' }
}
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
$staging = Join-Path $targetDir ('timmy-' + [Guid]::NewGuid().ToString('N') + '.tmp')
try {
  Copy-Item -LiteralPath $sourceExe -Destination $staging
  if ((Get-FileHash -LiteralPath $staging -Algorithm SHA256).Hash -ine $expected) { throw 'Staged executable checksum mismatch.' }
  Move-Item -LiteralPath $staging -Destination $installedExe -Force
} finally {
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging }
}
@{ application = 'timmy'; sha256 = $expected.ToLowerInvariant(); architecture = 'windows-x64' } |
  ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Update-UserPath $true
Write-Output "Timmy installed: $installedExe"
if (-not $NoPathUpdate) { Write-Output 'Open a new terminal to use timmy from PATH.' }
