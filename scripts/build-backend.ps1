$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $rootDir "services/api"
$outDir = Join-Path $rootDir "apps/desktop/src-tauri/bin"

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

$outputBase = "ionic-x-ms"
$outputName = "$outputBase.exe"
$outputNameWithTarget = "$outputBase-$targetTriple.exe"

Write-Host "Building backend ($goos/$goarch)..."
Push-Location $backendDir
$env:CGO_ENABLED = "0"
go build -o (Join-Path $outDir $outputNameWithTarget) ./cmd
Pop-Location

Copy-Item (Join-Path $outDir $outputNameWithTarget) (Join-Path $outDir $outputName) -Force

Write-Host "Backend built at $outDir\\$outputNameWithTarget"
