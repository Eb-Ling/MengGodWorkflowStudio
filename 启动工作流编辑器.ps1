$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "未找到 Node.js。请先安装 Node.js 18 或更高版本：https://nodejs.org/" -ForegroundColor Yellow
  Read-Host "按 Enter 退出"
  exit 1
}
$port = 4174
$env:WORKFLOW_BRIDGE_PORT = "$port"
$gateway = Join-Path $root "ai-gateway"
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "bridge.log"
Write-Host "正在启动 MengGod Workflow Studio..."
Write-Host "编辑器地址：http://127.0.0.1:$port/"
Write-Host "关闭此窗口即可停止本地桥接服务。"
Start-Process "http://127.0.0.1:$port/"
Push-Location $gateway
try {
  & $node.Source server.mjs *>> $log
} finally {
  Pop-Location
}
