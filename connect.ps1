<#
.SYNOPSIS
  Automates ADB Wireless Debugging and launches Flutter on your phone.
#>

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$envFile = Join-Path $root "device.env"

if (-not (Test-Path $envFile)) {
    Write-Error "device.env file not found in $root."
    exit 1
}

# 1. Parse device.env
$config = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line.Split("=", 2)
        if ($parts.Length -eq 2) {
            $config[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

$phoneIp = $config["PHONE_IP"]
$connectPort = $config["CONNECT_PORT"]
$pairingPort = $config["PAIRING_PORT"]
$pairingCode = $config["PAIRING_CODE"]

if (-not $phoneIp -or -not $connectPort) {
    Write-Host "[!] Please open device.env and set PHONE_IP and CONNECT_PORT first." -ForegroundColor Yellow
    exit 1
}

# 2. Auto-detect Laptop's Wi-Fi IP
$pcIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.InterfaceAlias -match 'Wi-Fi' -and $_.IPAddress -notmatch '169\.254'
    } | Select-Object -First 1).IPAddress

if (-not $pcIp) {
    $pcIp = "192.168.1.7"
}

Write-Host ">>> Detected Laptop Wi-Fi IP: $pcIp" -ForegroundColor Cyan

# 3. Update local.json automatically with the laptop's Wi-Fi IP
$localJsonPath = Join-Path $root "Adorini_Frontend\env\local.json"
$localJsonContent = @"
{
  "_comment": "Auto-updated by connect script",
  "API_BASE_URL": "http://${pcIp}:3000/api"
}
"@
Set-Content -Path $localJsonPath -Value $localJsonContent -Force
Write-Host ">>> Updated Adorini_Frontend/env/local.json to http://${pcIp}:3000/api" -ForegroundColor Green

# 4. Handle pairing if pairing code and port are provided
if ($pairingPort -and $pairingCode) {
    Write-Host ">>> Pairing with phone at $phoneIp`:$pairingPort with code $pairingCode..." -ForegroundColor Cyan
    & adb pair "$phoneIp`:$pairingPort" "$pairingCode"
}

# 5. Connect to phone wirelessly
Write-Host ">>> Connecting to phone at $phoneIp`:$connectPort..." -ForegroundColor Cyan
& adb connect "$phoneIp`:$connectPort"

# 6. Verify device
Write-Host ">>> Checking connected devices..." -ForegroundColor Cyan
& adb devices

# 7. Launch Flutter
Write-Host ">>> Starting Flutter shopping app..." -ForegroundColor Green
Set-Location (Join-Path $root "Adorini_Frontend")
flutter run --dart-define-from-file=env/local.json
