$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Instala Node.js 20.16+." }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw "No se encontro npm; revisa la instalacion de Node.js." }
$version = (& node --version).TrimStart('v').Split('.')
if (([int]$version[0] -lt 20) -or ([int]$version[0] -eq 20 -and [int]$version[1] -lt 16)) { throw "Requiere Node.js >=20.16." }
if (-not (Test-Path ".env")) {
  if (-not (Test-Path ".env.example")) { throw "No existe .env.example." }
  Copy-Item ".env.example" ".env"
  Write-Host "Se creo .env desde la plantilla. Configura MongoDB, SESSION_SECRET y demas opciones antes de ejecutar." -ForegroundColor Yellow
  exit 1
}
if (-not (Test-Path "node_modules")) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "Error instalando dependencias." }
}
$port = 3000
$portEntry = Get-Content ".env" | Where-Object { $_ -match '^PORT=' } | Select-Object -First 1
if ($portEntry) { $port = [int]($portEntry -replace '^PORT=', '') }
$url = "http://127.0.0.1:$port/"
$browserJob = Start-Job -ArgumentList $url -ScriptBlock {
  param($target)
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $target -TimeoutSec 2 -UseBasicParsing
      if ($response.StatusCode -ge 200) { Start-Process $target; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
}
Write-Host "Iniciando TaskFlow; requiere MongoDB accesible segun .env."
try { & npm.cmd start; exit $LASTEXITCODE }
finally { Stop-Job $browserJob -ErrorAction SilentlyContinue; Remove-Job $browserJob -Force -ErrorAction SilentlyContinue }
