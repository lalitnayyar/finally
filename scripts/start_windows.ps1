$ErrorActionPreference = "Stop"

$ImageName = "finally"
$ContainerName = "finally-app"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

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
    --env-file "$ProjectDir\.env" `
    $ImageName

if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "FinAlly is running at http://localhost:8000"
Start-Process "http://localhost:8000"
