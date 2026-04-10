$ErrorActionPreference = "Stop"

$result = docker rm -f finally-app 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "FinAlly stopped."
} else {
    Write-Host "FinAlly was not running."
}
