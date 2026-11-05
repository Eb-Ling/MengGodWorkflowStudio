param(
    [string]$GameRoot = 'E:\StarSector',
    [string]$JdkHome = $env:JAVA_HOME,
    [string]$Evidence = '',
    [string]$AlgorithmEvidence = ''
)
$ErrorActionPreference = 'Stop'
if (-not $Evidence) { $Evidence = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'verification/latest-p3-user-path.txt') -Raw).Trim() }
if (-not $AlgorithmEvidence) { $AlgorithmEvidence = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'verification/latest-noise-algorithms.txt') -Raw).Trim() }
$report = Get-Content -LiteralPath (Join-Path $Evidence 'report.json') -Raw | ConvertFrom-Json
if ($report.downloads.Count -ne 11) { throw 'Expected ten real UI Noise exports and one current built-in example export' }
$classes = Join-Path $Evidence 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$cp = "$(Join-Path $GameRoot 'starsector-core/*');$(Join-Path $GameRoot 'mods/BoxUtil/jars/BoxUtilMod.jar');$(Join-Path $GameRoot 'mods/BoxUtil/jars/backends/BoxUtilImpl.jar')"
$sources = @((Join-Path $Evidence 'WorkflowRuntime.java'), (Join-Path $PSScriptRoot 'NoiseShaderCheck.java'))
foreach ($download in $report.downloads) {
    if (@(Get-ChildItem -LiteralPath $download.directory -File -Recurse).Count -ne 3) { throw "Not a three-file export: $($download.name)" }
    $sources += Join-Path $download.directory "src/data/scripts/$($download.name).java"
}
# 编译用户界面实际下载的原始源码，不用模板或测试生成器替换它们。
& (Join-Path $JdkHome 'bin/javac.exe') -encoding UTF-8 -cp $cp -d $classes @sources
if ($LASTEXITCODE -ne 0) { throw 'Actual Noise Java exports failed compilation' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.NoiseShaderCheck $AlgorithmEvidence $Evidence 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'native-check.txt')
if ($LASTEXITCODE -ne 0) { throw 'Noise shader/algorithm verification failed' }
