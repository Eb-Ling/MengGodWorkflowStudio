$ErrorActionPreference = "Stop"
$desktop = Join-Path $PSScriptRoot "desktop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 18+ was not found. Install it from https://nodejs.org/."
}
if (-not (Test-Path -LiteralPath (Join-Path $desktop "package.json"))) {
  throw "Desktop build files were not found: $desktop"
}

Push-Location -LiteralPath $desktop
try {
  $builderCli = Join-Path $desktop "node_modules\electron-builder\cli.js"
  if (-not (Test-Path -LiteralPath $builderCli)) {
    Write-Host "Installing desktop dependencies..."
    npm install --fetch-retries=5 --fetch-retry-maxtimeout=120000
    if ($LASTEXITCODE -ne 0) {
      Write-Host "First install failed. Cleaning this project's dependency folder and npm cache, then retrying..." -ForegroundColor Yellow
      Remove-Item -LiteralPath (Join-Path $desktop "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
      npm cache clean --force
      npm install --fetch-retries=5 --fetch-retry-maxtimeout=120000
      if ($LASTEXITCODE -ne 0) {
        throw "Dependency download still failed. Check the network, proxy, and GitHub hosts entries, then try again."
      }
    }
  }
  npm run dist
  if ($LASTEXITCODE -ne 0) { throw "Desktop application build failed." }
} finally {
  Pop-Location
}
