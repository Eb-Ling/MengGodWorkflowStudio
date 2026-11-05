param(
    [string]$GameRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path,
    [string]$JdkHome = $env:JAVA_HOME,
    [string]$BoxUtilRoot = '',
    [string]$Evidence = '',
    [string]$PluginEvidence = ''
)
$ErrorActionPreference = 'Stop'
if (-not $JdkHome) { throw 'Pass -JdkHome pointing to JDK 17+.' }
if (-not $BoxUtilRoot) { $BoxUtilRoot = Join-Path $GameRoot 'mods/BoxUtil' }
if (-not $Evidence) { $Evidence = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'verification/latest-user-path.txt') -Raw).Trim() }
$report = Get-Content -LiteralPath (Join-Path $Evidence 'report.json') -Raw | ConvertFrom-Json
if ($report.downloads.Count -ne 6 -or $report.dependencies.Count -ne 2) { throw 'Expected six effect downloads and two dependency source downloads. Run test:user first.' }
$classes = Join-Path $Evidence 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null
$cp = "$(Join-Path $GameRoot 'starsector-core/*');$(Join-Path $BoxUtilRoot 'jars/BoxUtilMod.jar');$(Join-Path $BoxUtilRoot 'jars/backends/BoxUtilImpl.jar')"
$sources = @((Join-Path $PSScriptRoot 'UserPathExportCheck.java'), (Join-Path $PSScriptRoot 'RuntimeSafetyCheck.java'), $report.uiExample)
$sources += @($report.dependencies | ForEach-Object { $_.source })
foreach ($download in $report.downloads) {
    if (@(Get-ChildItem -LiteralPath $download.directory -File -Recurse).Count -ne 3) { throw "Effect export must contain exactly three files: $($download.name)" }
    $sources += Join-Path $download.directory "src/data/scripts/$($download.name).java"
}
if ($PluginEvidence) {
    $pluginRoot = Join-Path $PluginEvidence 'PluginApiEffect'
    if (@(Get-ChildItem -LiteralPath $pluginRoot -File -Recurse).Count -ne 3) { throw 'Plugin example must contain exactly three files' }
    $sources += Join-Path $pluginRoot 'src/data/scripts/PluginApiEffect.java'
    $originalRuntime = $report.dependencies | Where-Object runtimePath -eq 'data/method'
    if ((Get-FileHash -LiteralPath $originalRuntime.source).Hash -ne (Get-FileHash -LiteralPath (Join-Path $PluginEvidence 'WorkflowRuntime.java')).Hash) { throw 'Example runtime differs from the user-exported dependency' }
}
# Compile the downloaded sources unchanged; no source generator or repository runtime is substituted.
& (Join-Path $JdkHome 'bin/javac.exe') -encoding UTF-8 -Xlint:deprecation -cp $cp -d $classes @sources
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed for actual UI exports.' }
$batch = $report.downloads | Where-Object name -eq 'UserRouteBatch'
$java = Get-Content -LiteralPath (Join-Path $batch.directory 'src/data/scripts/UserRouteBatch.java') -Raw
$match = [regex]::Match($java, 'GL20\.glUniform1f\(uniform\("([^"\r\n]+)"\),\s*shared_stretch\)')
if (-not $match.Success) { throw 'Missing stretch uniform in actual exported Java.' }
$uniform = $match.Groups[1].Value
$nativeArguments = @($Evidence, $uniform)
if ($PluginEvidence) { $nativeArguments += $pluginRoot }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.UserPathExportCheck @nativeArguments 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'native-check.txt')
if ($LASTEXITCODE -ne 0) { throw 'Native validation failed for actual UI exports.' }
& (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.RuntimeSafetyCheck $Evidence 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'runtime-safety-check.txt')
if ($LASTEXITCODE -ne 0) { throw 'Runtime safety validation failed for actual UI exports.' }
