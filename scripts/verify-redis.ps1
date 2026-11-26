param([string]$MavenRepository)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$envFile=Join-Path $projectRoot '.env'
if(-not (Test-Path -LiteralPath $envFile)){throw 'Falta el archivo .env local.'}
Get-Content -LiteralPath $envFile | ForEach-Object {
 if($_ -match '^([A-Z_]+)=(.*)$'){[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2].Trim().Trim('"'),'Process')}
}
if([string]::IsNullOrWhiteSpace($env:REDIS_PASSWORD)){throw 'Completa REDIS_PASSWORD en .env y guarda el archivo. No se ha intentado autenticar.'}
if([string]::IsNullOrWhiteSpace($MavenRepository)){$MavenRepository=Join-Path $projectRoot '.maven-cache'}
Push-Location $projectRoot
try {
 & mvn.cmd -B -ntp "-Dmaven.repo.local=$MavenRepository" -pl ms-licencias '-Dredis.live=true' '-Dtest=RedisCloudTest' test
 if($LASTEXITCODE -ne 0){throw 'Falló la comprobación real de Redis Cloud. Revisar conectividad/configuración sin mostrar secretos.'}
} finally {Pop-Location}
