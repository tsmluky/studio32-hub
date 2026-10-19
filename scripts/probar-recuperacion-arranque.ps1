param()
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$state = Join-Path $repo '.local/operations/procesos.json'
$before = @((Get-Content -LiteralPath $state -Raw | ConvertFrom-Json).processes)
$ui = @($before | Where-Object name -eq 'interfaz')
if ($ui.Count -ne 1) { throw 'Debe haber una interfaz propia registrada.' }
$running = Get-Process -Id $ui[0].id -ErrorAction Stop
if ($running.StartTime.ToUniversalTime().Ticks -ne ([datetime]$ui[0].started).ToUniversalTime().Ticks) { throw 'No coincide el proceso de interfaz. No se toca.' }
# Stop only our development UI. Report/assistant/model services keep running.
Stop-Process -Id $running.Id
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'iniciar-mi-estudio.ps1') -SinAbrir
if ($LASTEXITCODE -ne 0) { throw 'No se recupero la interfaz.' }
$after = @((Get-Content -LiteralPath $state -Raw | ConvertFrom-Json).processes)
foreach ($item in $before | Where-Object name -ne 'interfaz') {
    $kept = $after | Where-Object name -eq $item.name
    if ($kept.id -ne $item.id -or ([datetime]$kept.started).Ticks -ne ([datetime]$item.started).Ticks) { throw "Se reinicio un servicio que debia conservarse: $($item.name)" }
}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'iniciar-mi-estudio.ps1') -SinAbrir
if ($LASTEXITCODE -ne 0) { throw 'Fallo al reabrir el conjunto sano.' }
$again = @((Get-Content -LiteralPath $state -Raw | ConvertFrom-Json).processes)
foreach ($item in $after) {
    $kept = $again | Where-Object name -eq $item.name
    if ($kept.id -ne $item.id) { throw 'Se duplico un servicio al reabrir.' }
}
@{ testedAt = [datetime]::UtcNow.ToString('o'); recoveredOnlyUI = $true; preservedOtherServices = $true; reopenWithoutDuplicates = $true } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repo '.local/operations/recuperacion-verificada.json') -Encoding UTF8
Write-Host 'OK: interfaz recuperada, cuatro servicios conservados y reapertura sin duplicados.'
