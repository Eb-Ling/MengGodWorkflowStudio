$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = Join-Path $root "desktop"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host "未找到 Node.js 18+。" -ForegroundColor Yellow; Read-Host "按 Enter 退出"; exit 1 }
if (-not (Test-Path (Join-Path $desktop "package.json"))) { throw "找不到桌面构建文件：$desktop\package.json" }
Push-Location $desktop
try {
  $builderCli = Join-Path $desktop "node_modules\electron-builder\cli.js"
  if (-not (Test-Path $builderCli)) {
    Write-Host "正在安装桌面应用依赖..."
    npm install --fetch-retries=5 --fetch-retry-maxtimeout=120000
    if ($LASTEXITCODE -ne 0) {
      Write-Host "首次安装失败，正在清理当前项目的损坏依赖与 npm 缓存后重试..." -ForegroundColor Yellow
      Remove-Item -LiteralPath (Join-Path $desktop "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
      npm cache clean --force
      npm install --fetch-retries=5 --fetch-retry-maxtimeout=120000
      if ($LASTEXITCODE -ne 0) {
        throw "依赖下载仍然失败。请检查网络、代理和 hosts 中的 GitHub 映射后重试。"
      }
    }
  }
  npm run dist
  if ($LASTEXITCODE -ne 0) { throw "桌面应用构建失败。" }
} finally { Pop-Location }
