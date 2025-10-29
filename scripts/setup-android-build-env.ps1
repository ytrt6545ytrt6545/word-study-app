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
        throw "Android SDK source path not found: $TargetPath"
    }

    Write-Host "Creating junction $LinkPath -> $TargetPath"
    New-Item -ItemType Junction -Path $LinkPath -Target $TargetPath | Out-Null
}

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        Write-Host "Creating directory $Path"
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

$tmpOption = "-Djava.io.tmpdir=$tempPath"
if ([string]::IsNullOrWhiteSpace($env:JAVA_TOOL_OPTIONS)) {
    $env:JAVA_TOOL_OPTIONS = $tmpOption
} elseif ($env:JAVA_TOOL_OPTIONS -notmatch '(^|\s)-Djava\.io\.tmpdir=') {
    $env:JAVA_TOOL_OPTIONS = "$($env:JAVA_TOOL_OPTIONS) $tmpOption".Trim()
}

Write-Host "Session environment variables set:"
Write-Host "  ANDROID_SDK_ROOT=$env:ANDROID_SDK_ROOT"
Write-Host "  ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "  GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
Write-Host "  TEMP/TMP=$env:TEMP"
Write-Host "  JAVA_TOOL_OPTIONS=$env:JAVA_TOOL_OPTIONS"

if ($Persist) {
    Write-Host "Persisting values with setx..."
    setx ANDROID_SDK_ROOT $env:ANDROID_SDK_ROOT | Out-Null
    setx ANDROID_HOME $env:ANDROID_HOME | Out-Null
    setx GRADLE_USER_HOME $env:GRADLE_USER_HOME | Out-Null
    setx TEMP $env:TEMP | Out-Null
    setx TMP $env:TMP | Out-Null
    setx JAVA_TOOL_OPTIONS $env:JAVA_TOOL_OPTIONS | Out-Null
    Write-Host "Done. Open a new terminal to pick up the persisted values."
} else {
    Write-Host "Persist flag not provided; values applied only to the current session."
}
