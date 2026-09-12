param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('chrome', 'edge', 'firefox')]
    [string]$Browser,
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId,
    [string]$ExecutablePath = ''
)

$nativeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$selectedPath = if ([string]::IsNullOrWhiteSpace($ExecutablePath)) {
    Join-Path $nativeRoot 'build\eversoul-native-host.exe'
}
else {
    [Environment]::ExpandEnvironmentVariables($ExecutablePath.Trim('"'))
}
if (Test-Path -LiteralPath $selectedPath -PathType Container) {
    $selectedPath = Join-Path $selectedPath 'eversoul-native-host.exe'
}
$executable = [System.IO.Path]::GetFullPath($selectedPath)
if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "Native host executable was not found: $executable"
}
if ([System.IO.Path]::GetFileName($executable) -ne 'eversoul-native-host.exe') {
    throw "Native host executable must be named eversoul-native-host.exe: $executable"
}

$manifestPath = Join-Path (Split-Path -Parent $executable) 'pro.everlib.eversoul.context.json'
$manifest = [ordered]@{
    name = 'pro.everlib.eversoul.context'
    description = 'EverSoul SQLite context host'
    path = $executable
    type = 'stdio'
}
if ($Browser -eq 'firefox') {
    $manifest.allowed_extensions = @($ExtensionId)
    $registryPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\pro.everlib.eversoul.context'
}
else {
    $manifest.allowed_origins = @("chrome-extension://$ExtensionId/")
    $vendor = if ($Browser -eq 'edge') { 'Microsoft\Edge' } else { 'Google\Chrome' }
    $registryPath = "HKCU:\Software\$vendor\NativeMessagingHosts\pro.everlib.eversoul.context"
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $manifestPath
Write-Output "Registered $Browser native host: $manifestPath"
