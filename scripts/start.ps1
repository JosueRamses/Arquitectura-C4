param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
if(Test-Path "$projectRoot\.env") {
 Get-Content -LiteralPath "$projectRoot\.env" | ForEach-Object {
  if($_ -match '^([A-Z_]+)=(.*)$'){[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2].Trim().Trim('"'), 'Process')}
 }
}
$runtime=Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
if(-not $SkipBuild){
 Push-Location $projectRoot
 try { & mvn.cmd -B -ntp "-Dmaven.repo.local=$projectRoot\.maven-cache" package; if($LASTEXITCODE -ne 0){throw 'Error de compilación Maven'}; Push-Location frontend-angular;try{& npm.cmd ci --no-audit --no-fund; if($LASTEXITCODE -ne 0){throw 'Error al instalar Angular'}; & npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'Error de compilación Angular'}}finally{Pop-Location} } finally {Pop-Location}
}
$owned=@()
foreach($module in @('ms-contribuyentes','ms-vehiculos','ms-licencias','api-gateway')){
 $process=Start-Process java -ArgumentList @('-jar',"`"$projectRoot\$module\target\$module-1.0.0.jar`"",'--debug=false','--logging.level.root=INFO','--logging.level.org.springframework.web=OFF','--logging.level.reactor.netty=WARN') -WorkingDirectory $projectRoot -RedirectStandardOutput "$runtime\$module.out.log" -RedirectStandardError "$runtime\$module.err.log" -PassThru -WindowStyle Hidden
 $owned+=@{id=$process.Id;module=$module}
}
$web=Start-Process -FilePath (Get-Command node).Source -ArgumentList @("`"$projectRoot\frontend-angular\node_modules\@angular\cli\bin\ng.js`"",'serve','--host','127.0.0.1','--port','4200') -WorkingDirectory "$projectRoot\frontend-angular" -RedirectStandardOutput "$runtime\frontend.out.log" -RedirectStandardError "$runtime\frontend.err.log" -PassThru -WindowStyle Hidden
$owned+=@{id=$web.Id;module='frontend'}
$owned | ConvertTo-Json | Set-Content "$runtime\processes.json"
Write-Host 'Aplicación: http://localhost:4200 · Los servicios tardan unos segundos en iniciar.'
