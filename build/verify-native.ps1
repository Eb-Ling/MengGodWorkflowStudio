param(
    [string]$GameRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path,
    [string]$JdkHome = $env:JAVA_HOME,
    [string]$BoxUtilRoot = ''
)
$ErrorActionPreference = 'Stop'
if (-not $JdkHome) { throw 'Set JAVA_HOME to a JDK 17+ directory or pass -JdkHome.' }
if (-not $BoxUtilRoot) { $BoxUtilRoot = Join-Path $GameRoot 'mods/BoxUtil' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$classes = Join-Path $PSScriptRoot 'verification/classes'
$cp = "$(Join-Path $GameRoot 'starsector-core/*');$(Join-Path $BoxUtilRoot 'jars/BoxUtilMod.jar');$(Join-Path $BoxUtilRoot 'jars/backends/BoxUtilImpl.jar')"
Push-Location -LiteralPath $repo
try {
    $sources = @('frontend/runtime/WorkflowBatch.java', 'frontend/runtime/WorkflowGlState.java', 'build/RenderRegression.java', 'build/ConstructorRegression.java')
    $sources += @(Get-ChildItem -LiteralPath 'build/verification' -Filter '*.java' | ForEach-Object FullName)
    $sources += @(Get-ChildItem -LiteralPath 'src' -Recurse -Filter '*.java' | ForEach-Object FullName)
    & (Join-Path $JdkHome 'bin/javac.exe') -encoding UTF-8 -Xlint:deprecation -cp $cp -d $classes @sources
    if ($LASTEXITCODE -ne 0) { throw 'Generated Java / shared runtime / Java graph adapter compilation failed.' }
    & (Join-Path $JdkHome 'bin/java.exe') -cp "$classes;$cp" data.scripts.workflow.ConstructorRegression
    if ($LASTEXITCODE -ne 0) { throw 'Generated constructor regression failed.' }
    & (Join-Path $JdkHome 'bin/java.exe') "-Djava.library.path=$(Join-Path $GameRoot 'starsector-core/native/windows')" -cp "$classes;$cp" data.scripts.workflow.RenderRegression build/verification
    if ($LASTEXITCODE -ne 0) { throw 'Native OpenGL regression failed.' }
} finally { Pop-Location }
