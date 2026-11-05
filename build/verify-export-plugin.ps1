param([string]$Evidence, [string]$JdkHome, [string]$GameRoot = 'E:\StarSector')
$ErrorActionPreference = 'Stop'
if (-not $Evidence -or -not $JdkHome) { throw 'Pass -Evidence and -JdkHome.' }
$report = Get-Content -LiteralPath (Join-Path $Evidence 'desktop-report.json') -Raw | ConvertFrom-Json
$mcp = Get-Content -LiteralPath (Join-Path $Evidence 'mcp-only/report.json') -Raw | ConvertFrom-Json
if ($report.downloads.Count -ne 6 -or -not $mcp.ok) { throw 'Expected six desktop exports and a successful independent MCP route.' }
$classes = Join-Path $Evidence 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$cp = "$(Join-Path $GameRoot 'starsector-core/*');$(Join-Path $GameRoot 'mods/BoxUtil/jars/BoxUtilMod.jar');$(Join-Path $GameRoot 'mods/BoxUtil/jars/backends/BoxUtilImpl.jar')"
$sources = @((Join-Path $PSScriptRoot 'PluginExportCheck.java'), (Join-Path $PSScriptRoot 'CompilerControlCheck.java')) + @($report.dependencies)
$directories = @()
foreach ($download in $report.downloads) {
    if (@(Get-ChildItem -LiteralPath $download.directory -Recurse -File).Count -ne 3) { throw 'Effect must contain exactly three original exported files.' }
    $sources += Join-Path $download.directory "src/data/scripts/$($download.name).java"
    $directories += $download.directory
}
$sources += Join-Path $Evidence 'mcp-only/src/data/scripts/McpExportEffect.java'
foreach ($control in $mcp.controls) {
    if (@(Get-ChildItem -LiteralPath $control.directory -Recurse -File).Count -ne 3) { throw 'Control case must contain three actual exported files' }
    $sources += Join-Path $control.directory "src/data/scripts/$($control.name).java"
}
$directories += Join-Path $Evidence 'mcp-only'
# 只编译用户界面下载和公开 MCP 返回的原始源码，不替换为仓库中的模板。
& (Join-Path $JdkHome 'bin/javac.exe') -encoding UTF-8 -cp $cp -d $classes @sources
if ($LASTEXITCODE -ne 0) { throw 'Actual exported Java compilation failed.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.PluginExportCheck @directories 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'native-check.txt')
if ($LASTEXITCODE -ne 0) { throw 'Actual exported GLSL linking failed.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.CompilerControlCheck (Join-Path $Evidence 'mcp-only/control-cases') 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'control-pixels.txt')
if ($LASTEXITCODE -ne 0) { throw 'Actual control flow shader pixels failed.' }
