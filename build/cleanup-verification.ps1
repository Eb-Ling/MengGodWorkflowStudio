param([switch]$Apply, [string]$Report = 'build/verification/cleanup-report.json', [string[]]$Rounds = @())
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$verification=(Resolve-Path -LiteralPath (Join-Path $workspace 'build/verification')).Path
$tempRoot=(Resolve-Path -LiteralPath ([IO.Path]::GetTempPath())).Path.TrimEnd([IO.Path]::DirectorySeparatorChar)
$reportPath=[IO.Path]::GetFullPath((Join-Path $workspace $Report))
if(-not $reportPath.StartsWith($verification+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw '清理报告必须在 verification 目录'}
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($reportPath)) -Force | Out-Null
# 仅处理已知验收命名规则，不触及正式用户配置、源码夹具、教学包或 release 历史。
$targets=[Collections.Generic.List[string]]::new()
foreach($roundName in $Rounds){
  if($roundName -notmatch '^[a-z0-9-]+-\d+$'){throw "无效验收目录名：$roundName"}
  if(-not(Test-Path -LiteralPath (Join-Path $verification $roundName) -PathType Container)){throw "验收目录不存在：$roundName"}
}
foreach($round in Get-ChildItem -LiteralPath $verification -Directory){
  if($Rounds.Count -and $round.Name -notin $Rounds){continue}
  foreach($name in @('profile','second-profile','my-layout','my-window','my-tools','my-nodes','my-panel')){
    $target=Join-Path $round.FullName $name
    if(Test-Path -LiteralPath $target -PathType Container){$targets.Add($target)}
  }
  if($round.Name -match '^user-route-profile-\d+$'){$targets.Add($round.FullName)}
}
foreach($name in @('workflow-p66-sdk-1793713197446','workflow-p67-sdk-1793718630318','workflow-p68-sdk-1793721308448','workflow-p69-sdk-1793724876157')){
  if($Rounds.Count){continue}
  $target=Join-Path $tempRoot $name
  if(Test-Path -LiteralPath $target -PathType Container){$targets.Add($target)}
}
$records=@()
foreach($target in $targets | Sort-Object -Unique){
  $absolute=(Resolve-Path -LiteralPath $target).Path
  $inside=$absolute.StartsWith($verification+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)
  $knownTemp=([IO.Path]::GetDirectoryName($absolute) -eq $tempRoot) -and ([IO.Path]::GetFileName($absolute) -match '^workflow-p6[6789]-sdk-\d+$')
  if(-not($inside -or $knownTemp)){throw "清理目标越界：$absolute"}
  # 不跟随链接。先检查本目录及所有子项，再进行递归删除。
  $items=@(Get-Item -LiteralPath $absolute)+@(Get-ChildItem -LiteralPath $absolute -Recurse -Force)
  if($items | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}){throw "清理目标包含链接：$absolute"}
  $files=@($items | Where-Object {-not $_.PSIsContainer})
  $records+=@{path=$absolute;files=$files.Count;bytes=($files | Measure-Object Length -Sum).Sum;deleted=$false}
}
if($Apply){
  $running=@(Get-CimInstance Win32_Process -Filter "name='MengGod Workflow Studio.exe' OR name='electron.exe'")
  foreach($record in $records){
    if($running | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($record.path)}){throw "验收配置仍被进程使用：$($record.path)"}
  }
  foreach($record in $records){
    Remove-Item -LiteralPath $record.path -Recurse -Force
    $record.deleted= -not(Test-Path -LiteralPath $record.path)
    if(-not $record.deleted){throw "清理失败：$($record.path)"}
  }
}
@{applied=[bool]$Apply;directories=$records.Count;items=$records;preserved='教学 SDK ZIP、回归测试源码、原始导出、截图和验证报告'} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding utf8
@{applied=[bool]$Apply;directories=$records.Count;files=($records | Measure-Object files -Sum).Sum;bytes=($records | Measure-Object bytes -Sum).Sum;report=$reportPath} | ConvertTo-Json
