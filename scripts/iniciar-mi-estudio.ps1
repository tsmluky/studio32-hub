param([switch]$Detener, [switch]$SinAbrir)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $repo '.local\operations'
$stateFile = Join-Path $stateDir 'procesos.json'
New-Item -ItemType Directory -Force $stateDir | Out-Null
if ($Detener) {
    if (Test-Path -LiteralPath $stateFile) {
        $owned = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        foreach ($item in @($owned.processes)) {
            $p = Get-Process -Id $item.id -ErrorAction SilentlyContinue
            if ($p -and $p.StartTime.ToUniversalTime().ToString('o') -eq $item.started) {
                & taskkill.exe /PID $item.id /T /F | Out-Null
            }
        }
        Remove-Item -LiteralPath $stateFile
    }
    Write-Host 'Mi estudio: servicios propios detenidos. Tus datos se conservan.'
    exit 0
}
if (Test-Path -LiteralPath $stateFile) {
    try {
        $existing = Invoke-WebRequest 'http://127.0.0.1:4310/mesa.html' -UseBasicParsing -TimeoutSec 2
        if ($existing.StatusCode -eq 200) {
            Write-Host 'Mi estudio ya esta abierto: http://127.0.0.1:4310/mesa.html'
            if (-not $SinAbrir) { Start-Process 'http://127.0.0.1:4310/mesa.html' -WindowStyle Hidden }
            exit 0
        }
    } catch { }
    throw 'Hay un registro de servicios anterior. Ejecuta primero este script con -Detener.'
}
foreach ($port in @(4310, 4311, 11435)) {
    $client = New-Object Net.Sockets.TcpClient
    try { if ($client.ConnectAsync('127.0.0.1', $port).Wait(300) -and $client.Connected) { throw "El puerto $port ya esta ocupado. No se toca ese servicio." } }
    catch [System.AggregateException] { } finally { $client.Dispose() }
}
$inventory = & py -3 (Join-Path $PSScriptRoot 'evaluar-asistente-local.py') --inventory | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $inventory.avail_commit_GiB -lt 8 -or $inventory.avail_phys_GiB -lt 4) { throw 'Falta margen de memoria para arrancar la IA. Libera recursos y vuelve a abrir Mi estudio.' }
$node = (Get-Command node).Source
$ollama = (Get-Command ollama).Source
if (-not (Test-Path -LiteralPath (Join-Path $repo 'node_modules\vite\bin\vite.js'))) { throw 'Faltan las dependencias del Hub. Ejecuta npm install en esta carpeta.' }
$processes = @()
$names = @('OLLAMA_HOST','OLLAMA_NO_CLOUD','OLLAMA_CONTEXT_LENGTH','OLLAMA_KEEP_ALIVE','OLLAMA_MAX_LOADED_MODELS')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
function Start-Owned([string]$Exe, [string]$Arguments, [string]$Name) {
    $p = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput (Join-Path $stateDir "$Name.stdout.log") -RedirectStandardError (Join-Path $stateDir "$Name.stderr.log")
    return @{ id = $p.Id; started = $p.StartTime.ToUniversalTime().ToString('o'); name = $Name }
}
try {
    $env:OLLAMA_HOST='127.0.0.1:11435'; $env:OLLAMA_NO_CLOUD='1'; $env:OLLAMA_CONTEXT_LENGTH='4096'; $env:OLLAMA_KEEP_ALIVE='2m'; $env:OLLAMA_MAX_LOADED_MODELS='1'
    $processes += Start-Owned $ollama 'serve' 'ollama'
    $processes += Start-Owned $node 'scripts/operations-server.mjs' 'servicio'
    if (Test-Path -LiteralPath (Join-Path $repo '.local\report-worker\worker.env')) {
        $processes += Start-Owned $node 'scripts/report-worker.mjs' 'informes'
        $processes += Start-Owned $node 'scripts/assistant-worker.mjs' 'asistente-remoto'
    }
    $processes += Start-Owned $node 'node_modules/vite/bin/vite.js --config vite.operations.config.ts' 'interfaz'
    @{ processes = $processes } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $stateFile -Encoding UTF8
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        foreach ($item in $processes) { if (-not (Get-Process -Id $item.id -ErrorAction SilentlyContinue)) { throw "No arranco $($item.name). Revisa .local/operations/$($item.name).stderr.log." } }
        try {
            $page = Invoke-WebRequest 'http://127.0.0.1:4310/mesa.html' -UseBasicParsing -TimeoutSec 2
            $session = Invoke-RestMethod 'http://127.0.0.1:4311/api/operations/session' -TimeoutSec 2
            $tags = Invoke-RestMethod 'http://127.0.0.1:11435/api/tags' -TimeoutSec 2
            if ($page.StatusCode -eq 200 -and $session.token -and ($tags.models | Where-Object name -eq 'qwen3.5:4b')) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'No se completo el arranque. Revisa los logs de .local/operations. Se necesita el modelo qwen3.5:4b ya descargado.' }
    Write-Host 'Mi estudio listo: http://127.0.0.1:4310/mesa.html'
    Write-Host 'Fichas e informes reales; notas, visitas y conversaciones guardadas en este sobremesa.'
    if (-not $SinAbrir) { Start-Process 'http://127.0.0.1:4310/mesa.html' -WindowStyle Hidden }
} catch {
    foreach ($item in $processes) { & taskkill.exe /PID $item.id /T /F 2>$null | Out-Null }
    if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile }
    throw
} finally { foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') } }
