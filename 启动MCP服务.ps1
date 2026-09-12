$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host "未找到 Node.js，请先安装 Node.js 18 或更高版本。" -ForegroundColor Yellow; Read-Host "按 Enter 退出"; exit 1 }
$env:WORKFLOW_BRIDGE_URL = "http://127.0.0.1:4174"
Push-Location (Join-Path $root "ai-gateway")
try { & $node.Source mcp-server.mjs } finally { Pop-Location }
