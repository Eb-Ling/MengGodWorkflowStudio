param([string]$ExportEvidence, [string]$ProjectEvidence, [string]$McpEvidence, [string]$JdkHome, [string]$GameRoot = 'E:\StarSector')
$ErrorActionPreference = 'Stop'
foreach ($required in @($ExportEvidence, $ProjectEvidence, $McpEvidence, $JdkHome)) { if (-not $required) { throw 'Pass all evidence directories and -JdkHome.' } }
$exports = Get-Content -LiteralPath (Join-Path $ExportEvidence 'desktop-report.json') -Raw | ConvertFrom-Json
$project = Get-Content -LiteralPath (Join-Path $ProjectEvidence 'report.json') -Raw | ConvertFrom-Json
$mcp = Get-Content -LiteralPath (Join-Path $McpEvidence 'report.json') -Raw | ConvertFrom-Json
if ($exports.downloads.Count -ne 6 -or $project.downloads.Count -ne 2 -or -not $mcp.ok) { throw 'Actual UI/MCP route incomplete.' }
$classes = Join-Path $ProjectEvidence 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$cp = "$(Join-Path $GameRoot 'starsector-core/*');$(Join-Path $GameRoot 'mods/BoxUtil/jars/BoxUtilMod.jar');$(Join-Path $GameRoot 'mods/BoxUtil/jars/backends/BoxUtilImpl.jar')"
$dependencyHashes = @($exports.dependencies | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash })
foreach ($dependency in $project.dependencies) {
    if ((Get-FileHash -LiteralPath $dependency -Algorithm SHA256).Hash -notin $dependencyHashes) { throw 'Project route exported a different runtime dependency.' }
}
$sources = @((Join-Path $PSScriptRoot 'PluginExportCheck.java'), (Join-Path $PSScriptRoot 'CompilerControlCheck.java')) + @($exports.dependencies)
$directories = @()
foreach ($download in @($exports.downloads) + @($project.downloads) + @($mcp.controls)) {
    if (@(Get-ChildItem -LiteralPath $download.directory -Recurse -File).Count -ne 3) { throw 'Each effect must contain exactly three original exported files.' }
    $sources += Join-Path $download.directory "src/data/scripts/$($download.name).java"
    if ($download.name -notlike 'Mcp*') { $directories += $download.directory }
}
$sources += Join-Path $McpEvidence 'src/data/scripts/McpExportEffect.java'
$directories += $McpEvidence
# 仅编译用户下载、公开 MCP 返回的原始源码；运行依赖只加入一次。
& (Join-Path $JdkHome 'bin/javac.exe') -encoding UTF-8 -cp $cp -d $classes @sources
if ($LASTEXITCODE -ne 0) { throw 'Actual exported Java compilation failed.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.PluginExportCheck @directories 2>&1 | Tee-Object -FilePath (Join-Path $ProjectEvidence 'native-check.txt')
if ($LASTEXITCODE -ne 0) { throw 'Actual exported GLSL linking failed.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.CompilerControlCheck (Join-Path $McpEvidence 'control-cases') 2>&1 | Tee-Object -FilePath (Join-Path $ProjectEvidence 'control-pixels.txt')
if ($LASTEXITCODE -ne 0) { throw 'Actual control flow shader pixels failed.' }
