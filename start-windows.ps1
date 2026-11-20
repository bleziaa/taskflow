$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or
    -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "Instala Node.js 22 LTS o utiliza el paquete que incluye Node.js."
}
if (-not (Test-Path "node_modules")) {
  & npm.cmd ci --omit=dev
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& node scripts/start-local.js @args
exit $LASTEXITCODE
