$ErrorActionPreference = "Stop"

$ImageName = "finally"
$ContainerName = "finally-app"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectDir ".env"
$PrecheckMessage = "Startup blocked: create .env from .env.example and set OPENROUTER_API_KEY before starting FinAlly."

if (-not (Test-Path $EnvFile)) {
    Write-Error $PrecheckMessage
    exit 1
}

$EnvContent = Get-Content $EnvFile -ErrorAction Stop
if (-not ($EnvContent | Where-Object { $_ -match '^\s*OPENROUTER_API_KEY\s*=\s*\S+' })) {
    Write-Error $PrecheckMessage
    exit 1
}

# Build if needed or --build flag passed
$needsBuild = $args -contains "--build"
if (-not $needsBuild) {
    $inspect = docker image inspect $ImageName 2>&1
    if ($LASTEXITCODE -ne 0) { $needsBuild = $true }
}

if ($needsBuild) {
    Write-Host "Building Docker image..."
    $env:DOCKER_BUILDKIT = "0"
    docker build -t $ImageName $ProjectDir
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# Stop existing container if running
docker rm -f $ContainerName 2>$null | Out-Null

Write-Host "Starting FinAlly..."
docker run -d `
    --name $ContainerName `
    -v finally-data:/app/db `
    -p 8000:8000 `
    --env-file $EnvFile `
    $ImageName

if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "FinAlly is running at http://localhost:8000"
Start-Process "http://localhost:8000"
