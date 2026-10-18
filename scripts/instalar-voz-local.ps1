$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
  if (-not (Test-Path -LiteralPath '.local\voice\Scripts\python.exe')) {
    & py -3 -m venv '.local\voice'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno local de voz.' }
  }
  & '.local\voice\Scripts\python.exe' -m pip install --disable-pip-version-check -r 'scripts\voice-requirements.lock.txt'
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar el transcriptor.' }
  & '.local\voice\Scripts\python.exe' 'scripts\transcribir-local.py' --install-model
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar el modelo de voz.' }
  Write-Host 'Voz local instalada. Abre Mi estudio y usa el microfono del asistente.'
} finally { Pop-Location }
