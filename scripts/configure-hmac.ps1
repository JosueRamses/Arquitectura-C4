param([switch]$Rotate)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$envPath=Join-Path $projectRoot '.env'
$envText=if(Test-Path -LiteralPath $envPath){[IO.File]::ReadAllText($envPath)}else{''}
if(-not $Rotate -and $envText -match '(?m)^CACHE_HMAC_SECRET=.{32,}\r?$'){Write-Host 'Se conserva la clave HMAC existente.';return}
$randomBytes=New-Object byte[] 48
$generator=[Security.Cryptography.RandomNumberGenerator]::Create()
try{$generator.GetBytes($randomBytes)}finally{$generator.Dispose()}
$secret=[Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
if($envText -match '(?m)^CACHE_HMAC_SECRET=.*$'){$envText=[regex]::Replace($envText,'(?m)^CACHE_HMAC_SECRET=.*$',('CACHE_HMAC_SECRET='+$secret))}else{$envText=$envText.TrimEnd()+"`nCACHE_HMAC_SECRET=$secret`n"}
[IO.File]::WriteAllText($envPath,$envText,(New-Object Text.UTF8Encoding $false))
Write-Host 'Clave HMAC de 384 bits guardada en .env sin mostrarla.'
