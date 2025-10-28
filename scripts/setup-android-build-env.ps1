# Requires PowerShell 5+
param(
    [string]$SdkSource = "$env:USERPROFILE\AppData\Local\Android\Sdk",
    [switch]$Persist
)

$ErrorActionPreference = 'Stop'

function New-JunctionIfMissing {
    param(
        [string]$LinkPath,
        [string]$TargetPath
    )

    if (Test-Path $LinkPath) {
        return
    }

    if (-not (Test-Path $TargetPath)) {
        throw "指定的 SDK 來源路徑不存在：$TargetPath"
    }

    Write-Host "建立連結 $LinkPath -> $TargetPath"
    New-Item -ItemType Junction -Path $LinkPath -Target $TargetPath | Out-Null
}

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        Write-Host "建立資料夾：$Path"
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

$asciiSdkPath = 'C:\android-sdk'
$gradleCache = 'C:\word-study-app\.gradle-cache'
$tempPath = 'C:\temp'

New-JunctionIfMissing -LinkPath $asciiSdkPath -TargetPath $SdkSource
Ensure-Directory -Path $gradleCache
Ensure-Directory -Path $tempPath

$env:ANDROID_SDK_ROOT = $asciiSdkPath
$env:ANDROID_HOME = $asciiSdkPath
$env:GRADLE_USER_HOME = $gradleCache
$env:TEMP = $tempPath
$env:TMP = $tempPath

Write-Host "已設定目前工作階段環境變數："
Write-Host "  ANDROID_SDK_ROOT=$env:ANDROID_SDK_ROOT"
Write-Host "  ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "  GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
Write-Host "  TEMP/TMP=$env:TEMP"

if ($Persist) {
    Write-Host "寫入使用者層級環境變數 (setx)..."
    setx ANDROID_SDK_ROOT $env:ANDROID_SDK_ROOT | Out-Null
    setx ANDROID_HOME $env:ANDROID_HOME | Out-Null
    setx GRADLE_USER_HOME $env:GRADLE_USER_HOME | Out-Null
    setx TEMP $env:TEMP | Out-Null
    setx TMP $env:TMP | Out-Null
    Write-Host "完成。請重新開啟終端機讓變更生效。"
} else {
    Write-Host "若需寫入使用者層級環境變數可加上 -Persist 參數。"
}
