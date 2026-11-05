param([string]$PreviewEvidence, [string]$ExportEvidence, [string]$JdkHome, [string]$GameRoot = 'E:\StarSector', [string]$UiEvidence = '', [string]$McpEvidence = '')
$ErrorActionPreference = 'Stop'
if (-not $PreviewEvidence -or -not $ExportEvidence -or -not $JdkHome) {
    throw 'Pass -PreviewEvidence, -ExportEvidence and -JdkHome.'
}
$preview = Get-Content -LiteralPath (Join-Path $PreviewEvidence 'report.json') -Raw | ConvertFrom-Json
$exports = Get-Content -LiteralPath (Join-Path $ExportEvidence 'desktop-report.json') -Raw | ConvertFrom-Json
$mcpRoot = if ($McpEvidence) { $McpEvidence } else { Join-Path $PreviewEvidence 'mcp-only' }
$mcp = Get-Content -LiteralPath (Join-Path $mcpRoot 'report.json') -Raw | ConvertFrom-Json
if (-not $preview.ok -or -not $mcp.ok -or $preview.downloads.Count -ne 1 -or $exports.downloads.Count -ne 6) {
    throw 'Expected successful independent user routes: one preview export and six export regressions.'
}
$classes = Join-Path $PreviewEvidence 'combined-classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$cp = "$(Join-Path $GameRoot 'starsector-core/*');$(Join-Path $GameRoot 'mods/BoxUtil/jars/BoxUtilMod.jar');$(Join-Path $GameRoot 'mods/BoxUtil/jars/backends/BoxUtilImpl.jar')"
# 同包运行依赖必须与用户下载物逐字相同，不能以仓库模板替换。
$previewRuntime = Join-Path $PreviewEvidence 'WorkflowRuntime.java'
if ((Get-FileHash -LiteralPath $previewRuntime).Hash -ne (Get-FileHash -LiteralPath $exports.dependencies[0]).Hash) {
    throw 'Runtime downloads differ; validate them in separate compilations.'
}
$sources = @((Join-Path $PSScriptRoot 'PluginExportCheck.java'), (Join-Path $PSScriptRoot 'CompilerControlCheck.java')) + @($exports.dependencies)
$directories = @()
foreach ($download in @($preview.downloads) + @($exports.downloads)) {
    if (@(Get-ChildItem -LiteralPath $download.directory -Recurse -File).Count -ne 3) { throw 'Effect must contain three original files.' }
    $sources += Join-Path $download.directory "src/data/scripts/$($download.name).java"
    $directories += $download.directory
}
if ($UiEvidence) {
    $uiReport = Get-Content -LiteralPath (Join-Path $UiEvidence 'report.json') -Raw | ConvertFrom-Json
    if (-not $uiReport.ok -or $uiReport.downloads.Count -ne 1) { throw 'Expected successful P5 UI route and one actual download.' }
    if ((Get-FileHash -LiteralPath $previewRuntime).Hash -ne (Get-FileHash -LiteralPath (Join-Path $UiEvidence 'WorkflowRuntime.java')).Hash) { throw 'P5 downloaded runtime differs.' }
    foreach ($download in $uiReport.downloads) {
        if (@(Get-ChildItem -LiteralPath $download.directory -Recurse -File).Count -ne 3) { throw 'P5 effect must contain three original files.' }
        $sources += Join-Path $download.directory "src/data/scripts/$($download.name).java"
        $directories += $download.directory
    }
}
$sources += Join-Path $mcpRoot 'src/data/scripts/McpExportEffect.java'
$directories += $mcpRoot
foreach ($control in $mcp.controls) {
    if (@(Get-ChildItem -LiteralPath $control.directory -Recurse -File).Count -ne 3) { throw 'Control case must contain three original files.' }
    $sources += Join-Path $control.directory "src/data/scripts/$($control.name).java"
}
& (Join-Path $JdkHome 'bin/javac.exe') -encoding UTF-8 -cp $cp -d $classes @sources
if ($LASTEXITCODE -ne 0) { throw 'Original exported Java compilation failed.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.PluginExportCheck @directories 2>&1 | Tee-Object -FilePath (Join-Path $PreviewEvidence 'combined-native-check.txt')
if ($LASTEXITCODE -ne 0) { throw 'Original exported GLSL linking failed.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.CompilerControlCheck (Join-Path $mcpRoot 'control-cases') 2>&1 | Tee-Object -FilePath (Join-Path $PreviewEvidence 'combined-control-pixels.txt')
if ($LASTEXITCODE -ne 0) { throw 'Control shader pixels failed.' }
