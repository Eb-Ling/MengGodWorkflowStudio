param([switch]$Apply)
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$keep=@('examples','MengGod-Workflow-Studio-1.0.0-win-x64','MengGod-Workflow-Studio-1.0.0-win-x64.zip','MengGod-Workflow-Studio-1.0.0-win-x64.zip.sha256','workflow-plugin-devkit-1.0.0.zip','workflow-plugin-devkit-1.0.0.zip.sha256')
$targets=[Collections.Generic.List[string]]::new()
foreach($item in Get-ChildItem -LiteralPath (Join-Path $workspace 'release')){
  if($item.Name -notin $keep -and ($item.Name -eq 'history' -or $item.Name -like 'MengGod*Workflow*')){$targets.Add($item.FullName)}
}
foreach($name in @('desktop/dist-1.0.7','desktop/dist-1.0.7-final','desktop/dist-1.0.7-fixed','desktop/dist-1.1.0','build/verification','release/examples/CenterSquareTest','TESTING_README.txt','assets/extracted-exe-icon.png','assets/extracted-exe-icon-v2.png','assets/extracted-portable-1.0.1-icon.png')){
 $path=Join-Path $workspace $name
 if(Test-Path -LiteralPath $path){$targets.Add($path)}
}
$processes=Get-CimInstance Win32_Process
$plan=@(foreach($path in $targets){
 $resolved=(Resolve-Path -LiteralPath $path).Path
 if(-not $resolved.StartsWith($workspace+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw ('清理路径越界：'+$resolved)}
 $entry=Get-Item -LiteralPath $resolved -Force
 $descendants=if($entry.PSIsContainer){@(Get-ChildItem -LiteralPath $resolved -Recurse -Force)}else{@()}
 if(@($entry)+$descendants | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}){throw ('清理目标包含链接：'+$resolved)}
 if($processes | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($resolved,[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and ($_.CommandLine.Contains($resolved) -or $_.CommandLine.Contains($resolved.Replace('\','/'))))}){throw ('目标仍被进程引用：'+$resolved)}
 $files=if($entry.PSIsContainer){@($descendants | Where-Object {-not $_.PSIsContainer})}else{@($entry)}
 [pscustomobject]@{Path=$resolved;Files=$files.Count;Bytes=($files | Measure-Object -Property Length -Sum).Sum}
})
$plan | Select-Object @{n='Path';e={$_.Path.Substring($workspace.Length+1)}},Files,Bytes | Format-Table -AutoSize
if($Apply){foreach($entry in $plan){Remove-Item -LiteralPath $entry.Path -Recurse -Force}}
[pscustomobject]@{Applied=[bool]$Apply;Targets=$plan.Count;Files=($plan | Measure-Object Files -Sum).Sum;Bytes=($plan | Measure-Object Bytes -Sum).Sum} | ConvertTo-Json
