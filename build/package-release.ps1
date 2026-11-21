param([switch]$SkipDevkit)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$release = Join-Path $workspace 'release'
$folder = Join-Path $release 'MengGod-Workflow-Studio-1.0.0-win-x64'
if (-not (Test-Path -LiteralPath $folder -PathType Container)) { throw '请先构建本地发布目录' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = $folder + '.zip'
$pending = $folder + '.' + [Guid]::NewGuid().ToString('N') + '.pending.zip'
# 运行日志不属于分发文件，既不读取也不修改，应用运行时也不会因此锁住打包。
$runtimeLog = Join-Path $folder 'debug.log'
$sourceFiles = @(Get-ChildItem -LiteralPath $folder -Recurse -File | Where-Object { $_.FullName -ne $runtimeLog })
$archive = [IO.Compression.ZipFile]::Open($pending,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($sourceFile in $sourceFiles) {
    $entryName = [IO.Path]::GetRelativePath($folder,$sourceFile.FullName).Replace('\','/')
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$sourceFile.FullName,$entryName,[IO.Compression.CompressionLevel]::Optimal)
  }
} finally { $archive.Dispose() }
$archive = [IO.Compression.ZipFile]::OpenRead($pending)
$count = 0
try {
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName.EndsWith('/')) { continue }
    $source = [IO.Path]::GetFullPath((Join-Path $folder $entry.FullName))
    if (-not $source.StartsWith($folder + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP 路径越界' }
    $stream = $entry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($actual -ne (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash) { throw ('ZIP 内容不一致：' + $entry.FullName) }
    $count++
  }
  if ($count -ne $sourceFiles.Count) { throw 'ZIP 文件数不一致' }
} finally { $archive.Dispose() }
Move-Item -LiteralPath $pending -Destination $zip -Force
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($zip+'.sha256',$hash+'  '+[IO.Path]::GetFileName($zip)+"`n")
if (-not $SkipDevkit) {
  Push-Location $workspace
  try {
    node --input-type=module -e "import {pluginDevkitBytes} from './build/package-plugin-devkit.mjs'; import fs from 'node:fs/promises'; await fs.writeFile('release/workflow-plugin-devkit-1.0.0.zip', await pluginDevkitBytes());"
    if ($LASTEXITCODE -ne 0) { throw '开发包生成失败' }
  } finally { Pop-Location }
  $sdk = Join-Path $release 'workflow-plugin-devkit-1.0.0.zip'
  $sdkHash = (Get-FileHash -LiteralPath $sdk -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText($sdk+'.sha256',$sdkHash+'  '+[IO.Path]::GetFileName($sdk)+"`n")
}
[pscustomobject]@{Files=$count;Bytes=(Get-Item -LiteralPath $zip).Length;SHA256=$hash;DevkitSHA256=$sdkHash} | ConvertTo-Json
