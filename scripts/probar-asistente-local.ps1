param(
    [ValidateSet('qwen3.5:4b', 'qwen3:4b')]
    [string]$Modelo = 'qwen3.5:4b',
    [switch]$SoloAdaptador,
    [switch]$InstruccionesEstrictas,
    [switch]$PlanMultiple
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$evaluador = Join-Path $PSScriptRoot 'evaluar-asistente-local.py'
$salida = Join-Path $repoRoot '.local\asistente'
$python = (Get-Command py -ErrorAction Stop).Source
$ollama = (Get-Command ollama -ErrorAction Stop).Source
$base = 'http://127.0.0.1:11435'

function Invoke-Evaluador([string[]]$Opciones) {
    & $python -3 $evaluador @Opciones
}

# Esta comprobacion no arranca servicios ni descarga nada.
$inventario = Invoke-Evaluador -Opciones @('--inventory') | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'No se pudo medir la memoria disponible.' }
Write-Host ('RAM libre: {0} GiB; memoria comprometible libre: {1} GiB' -f $inventario.avail_phys_GiB, $inventario.avail_commit_GiB)
if ($inventario.avail_commit_GiB -lt 8) {
    $inventario.largest_processes | Select-Object -First 3 name, pid, private_GiB | Format-Table
    Write-Host 'Prueba aplazada: necesita un margen conservador de 8 GiB comprometibles libres. No se ha iniciado ningun servicio.'
    exit 3
}
if ($inventario.avail_phys_GiB -lt 4) {
    Write-Host 'Prueba aplazada: menos de 4 GiB de RAM fisica libre. No se ha iniciado ningun servicio.'
    exit 3
}

$hayServidor = $false
try {
    Invoke-RestMethod "$base/api/version" -TimeoutSec 2 | Out-Null
    $hayServidor = $true
} catch { }
if ($hayServidor) { throw 'El puerto 11435 ya tiene un servicio. No se modifica ni se detiene.' }

New-Item -ItemType Directory -Force $salida | Out-Null
$previo = @{}
foreach ($nombre in @('OLLAMA_HOST', 'OLLAMA_NO_CLOUD', 'OLLAMA_CONTEXT_LENGTH', 'OLLAMA_KEEP_ALIVE', 'OLLAMA_MAX_LOADED_MODELS')) {
    $previo[$nombre] = [Environment]::GetEnvironmentVariable($nombre, 'Process')
}
$proceso = $null
$codigo = 2
try {
    $env:OLLAMA_HOST = '127.0.0.1:11435'
    $env:OLLAMA_NO_CLOUD = '1'
    $env:OLLAMA_CONTEXT_LENGTH = '4096'
    $env:OLLAMA_KEEP_ALIVE = '2m'
    $env:OLLAMA_MAX_LOADED_MODELS = '1'
    $proceso = Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $salida 'ollama.stdout.log') `
        -RedirectStandardError (Join-Path $salida 'ollama.stderr.log')
    $listo = $false
    for ($intento = 0; $intento -lt 20; $intento++) {
        if ($proceso.HasExited) { throw 'Ollama no pudo iniciarse; revisar .local/asistente/ollama.stderr.log.' }
        try {
            Invoke-RestMethod "$base/api/version" -TimeoutSec 2 | Out-Null
            $listo = $true
            break
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $listo) { throw 'El servidor local no esta disponible; revisar el log.' }
    $modelos = Invoke-RestMethod "$base/api/tags" -TimeoutSec 5
    if (-not ($modelos.models | Where-Object { $_.name -eq $Modelo })) {
        Write-Host "Descargando $Modelo en el almacen de modelos configurado en Ollama. Puede ocupar hasta unos 4 GB."
        & $ollama pull $Modelo
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar el modelo.' }
    }
    if ($SoloAdaptador -or $PlanMultiple) {
        $argumentosNodo = @((Join-Path $PSScriptRoot 'probar-adaptador-local.cjs'), $Modelo)
        if ($PlanMultiple) { $argumentosNodo += '--multiple' }
        & node @argumentosNodo
    } else {
        $opciones = @('--model', $Modelo, '--base-url', $base)
        if ($InstruccionesEstrictas) { $opciones += '--strict' }
        Invoke-Evaluador -Opciones $opciones
    }
    $codigo = $LASTEXITCODE
} finally {
    if ($proceso -and -not $proceso.HasExited) {
        # Solo el arbol que este script ha creado, nunca otros servicios de Ollama.
        & taskkill.exe /PID $proceso.Id /T /F | Out-Null
    }
    foreach ($nombre in $previo.Keys) {
        [Environment]::SetEnvironmentVariable($nombre, $previo[$nombre], 'Process')
    }
}
exit $codigo
