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
Write-Host "Iniciando TaskFlow. Requiere MongoDB accesible segun .env."
& npm.cmd start
exit $LASTEXITCODE
