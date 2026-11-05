$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host "未找到 Node.js，请先安装 Node.js 22.12 或更高版本。" -ForegroundColor Yellow; Read-Host "按 Enter 退出"; exit 1 }
if ((-not $env:WORKFLOW_MCP_CONNECTION_FILE -and -not $env:WORKFLOW_BRIDGE_URL) -or -not $env:WORKFLOW_MCP_TOKEN) {
    throw "请先在桌面程序的 MCP 工作流接入面板生成配置，并设置其中的 WORKFLOW_MCP_CONNECTION_FILE 和 WORKFLOW_MCP_TOKEN。"
}
Push-Location (Join-Path $root "ai-gateway")
try { & $node.Source ./mcp-client.mjs } finally { Pop-Location }
