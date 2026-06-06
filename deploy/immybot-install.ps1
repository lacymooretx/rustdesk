<#
.SYNOPSIS
    ImmyBot System Script - RustDesk Client Install for Aspendora Technologies

.DESCRIPTION
    Runs on the target computer as SYSTEM. Downloads the Aspendora-signed RustDesk
    client, installs silently, configures for rd.aspendora.com, and calls the
    console API to auto-assign the device to a group matching the ImmyBot tenant.

.NOTES
    ImmyBot Setup:
    1. Library > Software > Create
    2. Software Type: Custom
    3. Install Script: This file (System context)
    4. Detection Script: immybot-detect.ps1
    5. Uninstall Script: immybot-uninstall.ps1
    6. Add a parameter: $TenantName (Text, Auto checked)
    7. Create deployment with Desired State: Installed
#>

#region Configuration

$GitHubRepo       = "lacymooretx/rustdesk"
$GitHubRelease    = "nightly"
$IdServer         = "rd.aspendora.com"
$RelayServer      = "rd.aspendora.com"
$ConsoleApiBase   = "https://rd.aspendora.com/api"
$ConsoleApiToken  = ""  # Set to your arc_... API token from the RustDesk console

#endregion

#region Helper Functions

function Write-Log {
    param(
        [Parameter(Mandatory)]
        [string]$Message,
        [ValidateSet('Info', 'Warning', 'Error', 'Success')]
        [string]$Level = 'Info'
    )
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $prefix = switch ($Level) {
        'Info'    { '[INFO]' }
        'Warning' { '[WARN]' }
        'Error'   { '[ERROR]' }
        'Success' { '[OK]' }
    }
    Write-Host "$ts $prefix $Message"
}

#endregion

$ErrorActionPreference = "Stop"

Write-Log "=== RustDesk Install ==="
Write-Log "Server:    $IdServer"
Write-Log "Running as: $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
if ($TenantName) { Write-Log "Tenant:    $TenantName" }

# ============================================================
# Step 0: Resolve latest installer URL from GitHub Release
# ============================================================
Write-Log "Step 0: Resolving latest installer from GitHub ($GitHubRepo @ $GitHubRelease)..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$releaseUrl = "https://api.github.com/repos/$GitHubRepo/releases/tags/$GitHubRelease"
$release = Invoke-RestMethod -Uri $releaseUrl -Headers @{ "User-Agent" = "ImmyBot" } -ErrorAction Stop

$asset = $release.assets | Where-Object { $_.name -match "^rustdesk-.*x86_64\.exe$" } | Select-Object -First 1
if (-not $asset) {
    throw "Could not find x86_64.exe asset in GitHub release '$GitHubRelease'"
}

$InstallerUrl = $asset.browser_download_url
Write-Log "Resolved: $($asset.name) ($([math]::Round($asset.size / 1MB, 2)) MB)"

# ============================================================
# Step 1: Stop existing RustDesk
# ============================================================
Write-Log "Step 1: Stopping existing RustDesk..."

$svc = Get-Service -Name "RustDesk" -ErrorAction SilentlyContinue
if ($svc) {
    Stop-Service -Name "RustDesk" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Log "Service stopped"
}

Get-Process -Name "rustdesk" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Log "Processes cleared"

# ============================================================
# Step 2: Download installer
# ============================================================
$guid = [guid]::NewGuid().ToString().Substring(0, 8)
$installerPath = Join-Path $env:TEMP "rustdesk-aspendora-$guid.exe"

Write-Log "Step 2: Downloading $InstallerUrl..."

$wc = New-Object System.Net.WebClient
$wc.DownloadFile($InstallerUrl, $installerPath)

$fileSize = (Get-Item $installerPath).Length
Write-Log "Downloaded: $([math]::Round($fileSize / 1MB, 2)) MB"

# ============================================================
# Step 3: Verify signature
# ============================================================
Write-Log "Step 3: Checking Authenticode signature..."
$sig = Get-AuthenticodeSignature -FilePath $installerPath
Write-Log "Signature: $($sig.Status) - $($sig.SignerCertificate.Subject)"

# ============================================================
# Step 4: Silent install (fire-and-forget, poll for binary)
# ============================================================
Write-Log "Step 4: Running silent install..."

$rdExe = "C:\Program Files\RustDesk\rustdesk.exe"

# Launch installer detached via cmd /c so it can't block
Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$installerPath`" --silent-install" -WindowStyle Hidden
Write-Log "Installer launched (detached)"

# Poll for the binary to appear
$installed = $false
for ($i = 1; $i -le 24; $i++) {  # up to 2 minutes
    Start-Sleep -Seconds 5
    if (Test-Path $rdExe) {
        $installed = $true
        Write-Log "Binary detected after $($i * 5)s"
        break
    }
    Write-Log "Waiting for install... ($($i * 5)s)"
}

if (-not $installed) {
    Write-Log "Binary not found after 120s" -Level Error
    Get-Process -Name "rustdesk*" -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -like "*TEMP*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
    throw "RustDesk binary not found after 120s install timeout"
}

Start-Sleep -Seconds 3
$installedVersion = (Get-Item $rdExe).VersionInfo.ProductVersion
Write-Log "Installed: v$installedVersion"

# ============================================================
# Step 5: Write configuration
# ============================================================
Write-Log "Step 5: Writing configuration for $IdServer..."

$configContent = @"
rendezvous_server = '$IdServer'
nat_type = 1
serial = 0

[options]
custom-rendezvous-server = '$IdServer'
relay-server = '$RelayServer'
api-server = 'https://$IdServer'
"@

# User-level config
$userConfigDir = Join-Path $env:APPDATA "RustDesk\config"
if (-not (Test-Path $userConfigDir)) {
    New-Item -ItemType Directory -Path $userConfigDir -Force | Out-Null
}
Set-Content -Path (Join-Path $userConfigDir "RustDesk2.toml") -Value $configContent -Force
Write-Log "Wrote user config"

# System-level config (LocalService)
$sysConfigDir = "C:\Windows\ServiceProfiles\LocalService\AppData\Roaming\RustDesk\config"
if (-not (Test-Path $sysConfigDir)) {
    New-Item -ItemType Directory -Path $sysConfigDir -Force | Out-Null
}
Set-Content -Path (Join-Path $sysConfigDir "RustDesk2.toml") -Value $configContent -Force
Write-Log "Wrote system config"

# ============================================================
# Step 6: Start service
# ============================================================
Write-Log "Step 6: Starting RustDesk service..."

Start-Sleep -Seconds 3
$svc = Get-Service -Name "RustDesk" -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -eq "Running") {
        Restart-Service -Name "RustDesk" -Force
        Write-Log "Service restarted"
    } else {
        Start-Service -Name "RustDesk"
        Write-Log "Service started"
    }
    Start-Sleep -Seconds 5
    $svc = Get-Service -Name "RustDesk"
    Write-Log "Service status: $($svc.Status)"
} else {
    Write-Log "RustDesk service not found" -Level Warning
}

# ============================================================
# Step 7: Read RustDesk ID
# ============================================================
Write-Log "Step 7: Reading RustDesk ID..."

$rustdeskId = $null
$idFile = "C:\Windows\ServiceProfiles\LocalService\AppData\Roaming\RustDesk\config\RustDesk.toml"
for ($i = 1; $i -le 6; $i++) {
    if (Test-Path $idFile) {
        $idContent = Get-Content $idFile -Raw
        if ($idContent -match "id\s*=\s*'([^']+)'") {
            $rustdeskId = $Matches[1]
            break
        }
    }
    Write-Log "Waiting for RustDesk ID (attempt $i/6)..."
    Start-Sleep -Seconds 5
}

if (-not $rustdeskId) {
    # Fallback: user-level
    $userIdFile = Join-Path $env:APPDATA "RustDesk\config\RustDesk.toml"
    if (Test-Path $userIdFile) {
        $idContent = Get-Content $userIdFile -Raw
        if ($idContent -match "id\s*=\s*'([^']+)'") {
            $rustdeskId = $Matches[1]
        }
    }
}

if ($rustdeskId) {
    Write-Log "RustDesk ID: $rustdeskId" -Level Success
} else {
    Write-Log "Could not read RustDesk ID" -Level Warning
}

# ============================================================
# Step 8: Auto-assign to device group by tenant name
# ============================================================
if ($rustdeskId -and $TenantName -and $ConsoleApiToken) {
    Write-Log "Step 8: Assigning device $rustdeskId to group '$TenantName'..."
    try {
        $headers = @{
            "Authorization" = "Bearer $ConsoleApiToken"
            "Content-Type"  = "application/json"
        }
        $body = @{ group_name = $TenantName; device_id = $rustdeskId } | ConvertTo-Json
        $response = Invoke-RestMethod `
            -Uri "$ConsoleApiBase/device-groups/auto-assign" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -ErrorAction Stop
        Write-Log "Device group: $($response.status) -> '$($response.group_name)' (created: $($response.group_created))" -Level Success
    } catch {
        Write-Log "Device group API call failed: $_ (install still succeeded)" -Level Warning
    }
} else {
    if (-not $ConsoleApiToken) { Write-Log "No API token configured - skipping group assignment" -Level Warning }
    if (-not $TenantName) { Write-Log "No TenantName - skipping group assignment" -Level Warning }
    if (-not $rustdeskId) { Write-Log "No RustDesk ID - skipping group assignment" -Level Warning }
}

# ============================================================
# Step 9: Cleanup
# ============================================================
Remove-Item $installerPath -Force -ErrorAction SilentlyContinue

Write-Log "=== RustDesk install complete (v$installedVersion) ==="
