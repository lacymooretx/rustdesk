# RustDesk Client - ImmyBot Uninstall Script

$ErrorActionPreference = "Stop"

# Stop service first
$svc = Get-Service -Name "RustDesk" -ErrorAction SilentlyContinue
if ($svc) {
    Stop-Service -Name "RustDesk" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Find uninstaller
$uninstallPaths = @(
    "C:\Program Files\RustDesk\rustdesk.exe"
)

foreach ($path in $uninstallPaths) {
    if (Test-Path $path) {
        Write-Host "Uninstalling RustDesk via $path"
        Start-Process -FilePath $path -ArgumentList "--uninstall" -Wait
        Start-Sleep -Seconds 3
        break
    }
}

# Verify removal
if (Test-Path "C:\Program Files\RustDesk\rustdesk.exe") {
    Write-Host "WARNING: RustDesk executable still present after uninstall"
}

# Clean up config
$configPaths = @(
    (Join-Path $env:APPDATA "RustDesk"),
    "C:\Windows\ServiceProfiles\LocalService\AppData\Roaming\RustDesk"
)
foreach ($p in $configPaths) {
    if (Test-Path $p) {
        Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Removed config directory: $p"
    }
}

Write-Host "RustDesk uninstalled"
