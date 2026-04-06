param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDir,

    [string]$PacketName = "chris-amulet-solo-handoff",

    [ValidateSet("full", "transition")]
    [string]$ExportScope = "full"
)

$ErrorActionPreference = "Stop"

function New-CleanDirectory {
    param([string]$Path)
    if (Test-Path $Path) {
        Remove-Item -Path $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path | Out-Null
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\..\..")).Path
$packetRoot = Join-Path $OutputDir $PacketName

Write-Host "[handoff] Repo root: $repoRoot"
Write-Host "[handoff] Packet root: $packetRoot"

New-CleanDirectory -Path $packetRoot

$fullOwnedFiles = @(
    "src/student/ChrisS/index.ts",
    "src/student/ChrisS/amuletData.ts",
    "src/student/ChrisS/amuletEffects.ts",
    "src/student/ChrisS/amuletChest.ts",
    "src/student/ChrisS/amuletSelectionUI.ts",
    "src/student/ChrisS/amuletHud.ts",
    "src/student/ChrisS/amuletUtils.ts",
    "src/student/ChrisS/debug.ts",
    "src/student/ChrisS/SOLO_REPO_TRANSITION.md",
    "src/student/ChrisS/NEW_REPO_CHAT_HANDOFF_PROMPT.md"
)

$transitionOwnedFiles = @(
    "src/student/ChrisS/SOLO_REPO_TRANSITION.md",
    "src/student/ChrisS/NEW_REPO_CHAT_HANDOFF_PROMPT.md",
    "src/student/ChrisS/export_solo_handoff.ps1"
)

$ownedFiles = if ($ExportScope -eq "transition") {
    $transitionOwnedFiles
} else {
    $fullOwnedFiles
}

$requiredHostFiles = @(
    "src/studentApi.ts",
    "src/studentSystemsHooks.ts",
    "src/studentSdk.ts",
    "src/studentHooks.ts",
    "package.json",
    "tsconfig.json",
    "vite.config.js"
)

foreach ($relPath in $ownedFiles) {
    $srcPath = Join-Path $repoRoot $relPath
    if (-not (Test-Path $srcPath)) {
        Write-Warning "[handoff] Missing owned file: $relPath"
        continue
    }
    $dstPath = Join-Path $packetRoot $relPath
    $dstDir = Split-Path -Parent $dstPath
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir | Out-Null
    }
    Copy-Item -Path $srcPath -Destination $dstPath -Force
}

$vfxSrc = Join-Path $repoRoot "src/student/ChrisS/vfx"
$vfxDst = Join-Path $packetRoot "src/student/ChrisS/vfx"
if ($ExportScope -eq "full" -and (Test-Path $vfxSrc)) {
    New-Item -ItemType Directory -Path $vfxDst -Force | Out-Null
    Copy-Item -Path (Join-Path $vfxSrc "*") -Destination $vfxDst -Recurse -Force
}

$hostRefDir = Join-Path $packetRoot "host-reference"
New-Item -ItemType Directory -Path $hostRefDir -Force | Out-Null
foreach ($relPath in $requiredHostFiles) {
    $srcPath = Join-Path $repoRoot $relPath
    if (-not (Test-Path $srcPath)) {
        Write-Warning "[handoff] Missing host reference file: $relPath"
        continue
    }
    $dstPath = Join-Path $hostRefDir $relPath
    $dstDir = Split-Path -Parent $dstPath
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }
    Copy-Item -Path $srcPath -Destination $dstPath -Force
}

$manifest = [ordered]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    sourceRepoRoot = $repoRoot
    packetRoot = $packetRoot
    exportScope = $ExportScope
    ownedFiles = $ownedFiles
    requiredHostFiles = $requiredHostFiles
    globalDependencies = @(
        "globalThis.__HeroEnginePhaserInternals",
        "globalThis.__heroEngineVfxRegistry",
        "globalThis.addRelicToHero",
        "globalThis.__heRelicCatalog",
        "globalThis.sprites",
        "globalThis.SpriteKind"
    )
}

$manifestPath = Join-Path $packetRoot "handoff-manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "[handoff] Done. Packet created at: $packetRoot"
Write-Host "[handoff] Next: open NEW_REPO_CHAT_HANDOFF_PROMPT.md from the packet in your new repo chat."
