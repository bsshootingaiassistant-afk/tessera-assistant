param(
  [int]$Port = 8787
)

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $idx = $trimmed.IndexOf('=')
    if ($idx -lt 1) { continue }
    $name = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim()
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

& (Join-Path $PSScriptRoot '.venv\Scripts\python.exe') -m uvicorn app:app --host 127.0.0.1 --port $Port
