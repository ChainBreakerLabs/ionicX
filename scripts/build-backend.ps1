$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $rootDir "services/api"
$tauriDir = Join-Path $rootDir "apps/desktop/src-tauri"
$outDir = Join-Path $tauriDir "bin"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$goarch = & go env GOARCH
$goos = & go env GOOS

$targetTriple = ""
if ($goos -eq "windows") {
    if ($goarch -eq "arm64") {
        $targetTriple = "aarch64-pc-windows-msvc"
    } else {
        $targetTriple = "x86_64-pc-windows-msvc"
    }
} elseif ($goos -eq "darwin") {
    if ($goarch -eq "arm64") {
        $targetTriple = "aarch64-apple-darwin"
    } else {
        $targetTriple = "x86_64-apple-darwin"
    }
} elseif ($goos -eq "linux") {
    if ($goarch -eq "arm64") {
        $targetTriple = "aarch64-unknown-linux-gnu"
    } else {
        $targetTriple = "x86_64-unknown-linux-gnu"
    }
}

$outputBase = "ionicx-api"
$outputName = "$outputBase.exe"
$outputNameWithTarget = "$outputBase-$targetTriple.exe"

Write-Host "Building backend ($goos/$goarch)..."
Push-Location $backendDir
$env:CGO_ENABLED = "0"
go build -o (Join-Path $outDir $outputNameWithTarget) ./cmd
Pop-Location

$binaryPath = Join-Path $outDir $outputNameWithTarget
if (-not (Test-Path $binaryPath)) {
    Write-Error "Build failed, binary not created at $binaryPath"
    exit 1
}

# Copy to generic name for convenience and to the Tauri root for bundling
$genericPath = Join-Path $outDir $outputName
if (-not (Copy-Item $binaryPath $genericPath -Force -PassThru)) {
    Write-Error "Failed to copy binary to $genericPath"
    exit 1
}

$rootTargetPath = Join-Path $tauriDir $outputNameWithTarget
if (-not (Copy-Item $binaryPath $rootTargetPath -Force -PassThru)) {
    Write-Error "Failed to copy binary to $rootTargetPath"
    exit 1
}

$rootGenericPath = Join-Path $tauriDir $outputName
if (-not (Copy-Item $binaryPath $rootGenericPath -Force -PassThru)) {
    Write-Error "Failed to copy binary to $rootGenericPath"
    exit 1
}

Write-Host "✓ Backend built at $binaryPath"
Write-Host "✓ Binary available as $genericPath"
