$ErrorActionPreference = "Stop"
$desktop = Join-Path $PSScriptRoot "desktop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22.12+ was not found. Install it from https://nodejs.org/."
}
if (-not (Test-Path -LiteralPath (Join-Path $desktop "package.json"))) {
  throw "Desktop build files were not found: $desktop"
}

Push-Location -LiteralPath $PSScriptRoot
try {
  Write-Host "Installing the locked UI toolchain..."
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install --frozen-lockfile
  } else {
    npm exec --yes --package=pnpm@11.25.0 -- pnpm install --frozen-lockfile
  }
  if ($LASTEXITCODE -ne 0) { throw "UI dependencies could not be installed." }
  node node_modules/vue-tsc/bin/vue-tsc.js --noEmit
  if ($LASTEXITCODE -ne 0) { throw "UI type check failed." }
} finally {
  Pop-Location
}

Push-Location -LiteralPath $desktop
try {
  $builderCli = Join-Path $desktop "node_modules\electron-builder\cli.js"
  if (-not (Test-Path -LiteralPath $builderCli)) {
    Write-Host "Installing desktop dependencies..."
    npm ci --fetch-retries=5 --fetch-retry-maxtimeout=120000
    if ($LASTEXITCODE -ne 0) {
      throw "Desktop dependency installation failed. Check the network and retry."
    }
  }
  npm run dist
  if ($LASTEXITCODE -ne 0) { throw "Desktop application build failed." }
} finally {
  Pop-Location
}
