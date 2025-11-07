[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$PurgeCache
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$cacheDir = Join-Path $PSScriptRoot '.cache'
if (-not (Test-Path $cacheDir)) {
    New-Item -Path $cacheDir -ItemType Directory | Out-Null
}

$patterns = @(
    'tmp_*.txt',
    'tmp_*.diff',
    'tmp_ai_test.js',
    'expo-web.log'
)

$removed = @()

foreach ($pattern in $patterns) {
    $globPath = Join-Path $repoRoot $pattern
    $targets = Get-ChildItem -Path $globPath -Force -ErrorAction SilentlyContinue
    foreach ($target in $targets) {
        if ($DryRun) {
            $removed += "Would remove: $($target.FullName)"
        }
        else {
            Remove-Item -Path $target.FullName -Force -Recurse
            $removed += "Removed: $($target.FullName)"
        }
    }
}

if ($PurgeCache) {
    $cacheTargets = Get-ChildItem -Path (Join-Path $cacheDir '*') -Force -ErrorAction SilentlyContinue
    foreach ($target in $cacheTargets) {
        if ($DryRun) {
            $removed += "Would purge cache entry: $($target.FullName)"
        }
        else {
            Remove-Item -Path $target.FullName -Force -Recurse
            $removed += "Purged cache entry: $($target.FullName)"
        }
    }
}

if ($removed.Count -eq 0) {
    if ($DryRun) {
        Write-Output 'Dry run: no匹配的暫存檔案。'
    }
    else {
        Write-Output '沒有需要清理的暫存檔案。'
    }
}
else {
    $removed | ForEach-Object { Write-Output $_ }
}

