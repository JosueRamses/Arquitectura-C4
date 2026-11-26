$projectRoot=[IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$state=Join-Path $projectRoot '.runtime\processes.json'
# Match the complete project path on the process command line before stopping it.
$ownedProcesses=Get-CimInstance Win32_Process -Filter "name = 'java.exe' OR name = 'node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($projectRoot+'\') }
foreach($ownedProcess in $ownedProcesses){Stop-Process -Id $ownedProcess.ProcessId -Force -ErrorAction SilentlyContinue; Wait-Process -Id $ownedProcess.ProcessId -ErrorAction SilentlyContinue}
if(Test-Path $state){Remove-Item -LiteralPath $state}
