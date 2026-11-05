param([string]$Evidence, [string]$JdkHome, [string]$GameRoot = 'E:\StarSector')
$ErrorActionPreference = 'Stop'
if (-not $Evidence -or -not $JdkHome) { throw 'Pass -Evidence and -JdkHome.' }
$report = Get-Content -LiteralPath (Join-Path $Evidence 'report.json') -Raw | ConvertFrom-Json
$mcpRoot = Join-Path $Evidence 'mcp-only'
$mcp = Get-Content -LiteralPath (Join-Path $mcpRoot 'report.json') -Raw | ConvertFrom-Json
if (-not $report.ok -or -not $mcp.ok -or $report.downloads.Count -ne 1 -or $mcp.controls.Count -ne 3) { throw 'Expected one desktop and four MCP effect downloads.' }
$classes = Join-Path $Evidence 'native-classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$cp = "$(Join-Path $GameRoot 'starsector-core/*');$(Join-Path $GameRoot 'mods/BoxUtil/jars/BoxUtilMod.jar');$(Join-Path $GameRoot 'mods/BoxUtil/jars/backends/BoxUtilImpl.jar')"
# 只编译本轮实际下载物，禁止用仓库模板或重新生成的源码替代。
$sources = @((Join-Path $PSScriptRoot 'PluginExportCheck.java'), (Join-Path $PSScriptRoot 'CompilerControlCheck.java'), (Join-Path $Evidence 'WorkflowRuntime.java'), (Join-Path $mcpRoot 'src/data/scripts/McpExportEffect.java'))
$directories = @($mcpRoot)
foreach ($download in @($report.downloads) + @($mcp.controls)) {
    if (@(Get-ChildItem -LiteralPath $download.directory -Recurse -File).Count -ne 3) { throw 'Each effect must contain exactly three original files.' }
    $sources += Join-Path $download.directory "src/data/scripts/$($download.name).java"
}
$directories += $report.downloads[0].directory
& (Join-Path $JdkHome 'bin/javac.exe') -encoding UTF-8 -cp $cp -d $classes @sources
if ($LASTEXITCODE -ne 0) { throw 'Original Java exports failed compilation.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.PluginExportCheck @directories 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'native-check.txt')
if ($LASTEXITCODE -ne 0) { throw 'Original GLSL exports failed linking.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.CompilerControlCheck (Join-Path $mcpRoot 'control-cases') 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'control-pixels.txt')
if ($LASTEXITCODE -ne 0) { throw 'MCP control shader pixels failed.' }
