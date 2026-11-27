param(
  [int]$Port = 8787
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$envFile = Join-Path $root '.env'

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

$python = $env:TESSERA_PYTHON
if (-not $python) {
  $python = (Get-Command python -ErrorAction SilentlyContinue).Source
}
if (-not $python -or -not (Test-Path $python)) {
  throw 'Python not found. Set TESSERA_PYTHON to a Python with worker dependencies.'
}

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Start-Process -FilePath $python `
    -ArgumentList "-m uvicorn app:app --host 127.0.0.1 --port $Port" `
    -WorkingDirectory $root `
    -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

$cloudflared = Join-Path $env:USERPROFILE 'bin\cloudflared.exe'
$tunnelLog = Join-Path $root 'cloudflared.log'
$urlFile = Join-Path $root 'tunnel-url.txt'

$running = Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" |
  Where-Object { $_.CommandLine -like "*$Port*" }
if (-not $running) {
  if (-not (Test-Path $cloudflared)) {
    throw "cloudflared not found at $cloudflared"
  }
  Remove-Item -LiteralPath $tunnelLog -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $root 'cloudflared.err.log') -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $cloudflared `
    -ArgumentList "tunnel --url http://127.0.0.1:$Port --no-autoupdate --logfile `"$tunnelLog`"" `
    -WindowStyle Hidden
}

$url = $null
for ($i = 0; $i -lt 30; $i += 1) {
  Start-Sleep -Seconds 1
  foreach ($log in @($tunnelLog, (Join-Path $root 'cloudflared.err.log'))) {
    if (-not (Test-Path $log)) { continue }
    $match = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' |
      Select-Object -Last 1
    if ($match) {
      $url = [regex]::Match($match.Line, 'https://[a-z0-9-]+\.trycloudflare\.com').Value
      break
    }
  }
  if ($url) { break }
}

if ($url) {
  Set-Content -Path $urlFile -Value $url -Encoding ascii
  Write-Output "TUNNEL_URL=$url"
} else {
  Write-Output 'TUNNEL_URL=not found yet, check worker/cloudflared.err.log'
}

Write-Output "WORKER=http://127.0.0.1:$Port"
