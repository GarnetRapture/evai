#Requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$SkipWebBuild,
    [switch]$SkipServerBuild
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$distDirectory = Join-Path $projectRoot 'dist'
$serverDirectory = Join-Path $projectRoot 'server'
$serverOutputDirectory = Join-Path $serverDirectory 'build\windows\x64\release'
$serverExecutable = Join-Path $serverOutputDirectory 'evai-server.exe'
$serverDatabaseDirectory = Join-Path $serverOutputDirectory 'evai-database'
$releaseDirectory = Join-Path $projectRoot 'tmp\release'
$userDataEntries = @('evai-database', 'evai-backup', 'evai-server.ini')
$systemModulePattern = '^(api-ms-win-|ext-ms-win-|kernel32|kernelbase|user32|shell32|advapi32|ws2_32|ntdll|ole32|oleaut32|gdi32|shlwapi|crypt32|bcrypt|secur32|version|winmm|dbghelp|powrprof|imm32|comdlg32|comctl32|setupapi|iphlpapi|userenv|wintrust|msvcrt)'

function Write-Step {
    param([string]$Message)
    Write-Host "  - $Message"
}

function Resolve-DumpbinPath {
    $installer = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path -LiteralPath $installer)) {
        throw "vswhere.exe not found at $installer"
    }
    $installationPath = & $installer -latest -property installationPath
    if ([string]::IsNullOrWhiteSpace($installationPath)) {
        throw 'No Visual Studio installation reported by vswhere'
    }
    $toolsRoot = Join-Path $installationPath 'VC\Tools\MSVC'
    $toolsVersion = Get-ChildItem -LiteralPath $toolsRoot -Directory | Sort-Object Name | Select-Object -Last 1
    if ($null -eq $toolsVersion) {
        throw "No MSVC toolset under $toolsRoot"
    }
    $dumpbin = Join-Path $toolsVersion.FullName 'bin\Hostx64\x64\dumpbin.exe'
    if (-not (Test-Path -LiteralPath $dumpbin)) {
        throw "dumpbin.exe not found at $dumpbin"
    }
    return [pscustomobject]@{ Dumpbin = $dumpbin; InstallationPath = $installationPath; ToolsVersion = $toolsVersion.Name }
}

function Resolve-RedistCrtDirectory {
    param([string]$InstallationPath)
    $redistRoot = Join-Path $InstallationPath 'VC\Redist\MSVC'
    $candidates = Get-ChildItem -LiteralPath $redistRoot -Recurse -Directory -Filter '*.CRT' -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match '\\x64\\' -and $_.FullName -notmatch 'onecore|Debug' } |
        Sort-Object FullName
    $crtDirectory = $candidates | Select-Object -Last 1
    if ($null -eq $crtDirectory) {
        throw "No redistributable x64 CRT directory under $redistRoot"
    }
    return $crtDirectory.FullName
}

function Get-ImportedModuleNames {
    param([string]$Dumpbin, [string]$BinaryPath)
    $output = & $Dumpbin /dependents $BinaryPath 2>&1
    return $output |
        Select-String -Pattern '^\s{4}\S+\.dll$' |
        ForEach-Object { $_.Line.Trim() }
}

function Copy-RuntimeDependency {
    param([string]$Dumpbin, [string]$CrtDirectory, [string]$BinaryPath, [string]$TargetDirectory)
    $pending = [System.Collections.Generic.Queue[string]]::new()
    $inspected = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $copied = [System.Collections.Generic.List[string]]::new()
    $pending.Enqueue($BinaryPath)
    while ($pending.Count -gt 0) {
        foreach ($moduleName in Get-ImportedModuleNames -Dumpbin $Dumpbin -BinaryPath $pending.Dequeue()) {
            if (-not $inspected.Add($moduleName) -or $moduleName -match $systemModulePattern) {
                continue
            }
            $redistPath = Join-Path $CrtDirectory $moduleName
            if (-not (Test-Path -LiteralPath $redistPath)) {
                continue
            }
            Copy-Item -LiteralPath $redistPath -Destination $TargetDirectory -Force
            $copied.Add($moduleName)
            $pending.Enqueue($redistPath)
        }
    }
    return $copied
}

function Invoke-WebBuild {
    Push-Location $projectRoot
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-ServerBuild {
    Push-Location $serverDirectory
    try {
        & xmake
        if ($LASTEXITCODE -ne 0) {
            throw "xmake failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Clear-ReleaseDirectory {
    param([bool]$RemoveUserData)
    if (-not (Test-Path -LiteralPath $releaseDirectory)) {
        New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
        return
    }
    Get-ChildItem -LiteralPath $releaseDirectory -Force |
        Where-Object { $RemoveUserData -or $userDataEntries -notcontains $_.Name } |
        Remove-Item -Recurse -Force -Confirm:$false
}

function Write-AssetSourceBlob {
    param([string]$PlainPath, [string[]]$TargetPaths)
    if (-not (Test-Path -LiteralPath $PlainPath)) {
        return 0
    }
    $magic = [System.Text.Encoding]::ASCII.GetBytes('EVAS1')
    $key = [System.Text.Encoding]::ASCII.GetBytes('evai-local-asset-index')
    $plain = [System.IO.File]::ReadAllBytes($PlainPath)
    $encoded = [byte[]]::new($magic.Length + $plain.Length)
    [System.Array]::Copy($magic, $encoded, $magic.Length)
    for ($offset = 0; $offset -lt $plain.Length; $offset++) {
        $mask = $key[$offset % $key.Length] -bxor (($offset * 31 + 7) -band 0xFF)
        $encoded[$magic.Length + $offset] = $plain[$offset] -bxor $mask
    }
    foreach ($target in $TargetPaths) {
        [System.IO.File]::WriteAllBytes($target, $encoded)
    }
    return $encoded.Length
}

function Copy-WebBundle {
    robocopy $distDirectory $releaseDirectory /E /PURGE /XF *.map evai-server.exe *.dll /XD $userDataEntries /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed with exit code $LASTEXITCODE"
    }
}

Write-Host ''
Write-Host "EVAI release refresh -> $releaseDirectory"
Write-Host ''

if (-not $SkipWebBuild) {
    Write-Step 'building web bundle'
    Invoke-WebBuild
}
if (-not $SkipServerBuild) {
    Write-Step 'building server'
    Invoke-ServerBuild
}

if (-not (Test-Path -LiteralPath $distDirectory)) {
    throw "Web bundle missing at $distDirectory"
}
if (-not (Test-Path -LiteralPath $serverExecutable)) {
    throw "Server executable missing at $serverExecutable"
}

if ($Clean) {
    Write-Step 'clearing release directory'
    Clear-ReleaseDirectory -RemoveUserData:$true
}

Write-Step 'syncing web bundle'
Copy-WebBundle

Write-Step 'copying server executable'
Copy-Item -LiteralPath $serverExecutable -Destination $releaseDirectory -Force

$releaseDatabaseDirectory = Join-Path $releaseDirectory 'evai-database'
if (-not (Test-Path -LiteralPath $releaseDatabaseDirectory)) {
    Write-Step 'copying fresh database'
    Copy-Item -LiteralPath $serverDatabaseDirectory -Destination $releaseDirectory -Recurse -Force
}

Write-Step 'encoding asset source list'
$assetSourceBytes = Write-AssetSourceBlob -PlainPath (Join-Path $projectRoot 'evai-assets.sources') -TargetPaths @(
    (Join-Path $projectRoot 'evai-assets.bin'),
    (Join-Path $releaseDirectory 'evai-assets.bin')
)

Write-Step 'resolving runtime dependencies'
$toolchain = Resolve-DumpbinPath
$crtDirectory = Resolve-RedistCrtDirectory -InstallationPath $toolchain.InstallationPath
$copiedModules = Copy-RuntimeDependency -Dumpbin $toolchain.Dumpbin -CrtDirectory $crtDirectory -BinaryPath (Join-Path $releaseDirectory 'evai-server.exe') -TargetDirectory $releaseDirectory

$fileCount = (Get-ChildItem -LiteralPath $releaseDirectory -Recurse -File).Count
$leftoverMaps = (Get-ChildItem -LiteralPath $releaseDirectory -Recurse -Filter *.map -File).Count

Write-Host ''
Write-Host "  toolset       $($toolchain.ToolsVersion)"
Write-Host "  redist        $crtDirectory"
Write-Host "  runtime dlls  $($copiedModules -join ', ')"
Write-Host "  asset list    $assetSourceBytes bytes"
Write-Host "  files         $fileCount"
Write-Host "  source maps   $leftoverMaps"
Write-Host ''
