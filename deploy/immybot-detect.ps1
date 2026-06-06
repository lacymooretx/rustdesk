<#
.SYNOPSIS
    ImmyBot Detection Script - RustDesk Client

.DESCRIPTION
    Returns the installed RustDesk version if installed and configured for
    rd.aspendora.com. Returns $null if not installed or misconfigured.

    ImmyBot parses the return value as a semantic version.

.NOTES
    This runs in System context on the target (NOT a metascript).
    Used as the Detection Script for the RustDesk software entry.
#>

$rdExe = "C:\Program Files\RustDesk\rustdesk.exe"

if (-not (Test-Path $rdExe)) {
    return $null
}

# Get version from the executable
$version = (Get-Item $rdExe).VersionInfo.ProductVersion
if (-not $version) {
    $version = (Get-Item $rdExe).VersionInfo.FileVersion
}

# Check if configured for our server
$configFile = "C:\Windows\ServiceProfiles\LocalService\AppData\Roaming\RustDesk\config\RustDesk2.toml"
if (-not (Test-Path $configFile)) {
    $configFile = Join-Path $env:APPDATA "RustDesk\config\RustDesk2.toml"
}

if (Test-Path $configFile) {
    $content = Get-Content $configFile -Raw
    if ($content -match "rd\.aspendora\.com") {
        return $version
    }
}

return $null
