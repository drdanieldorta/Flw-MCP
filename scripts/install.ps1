<#
Instalador do mdia-flw-mcp para Windows (PowerShell 5+).

Uso:
  powershell -ExecutionPolicy Bypass -File scripts/install.ps1 -Client all -Token pn_xxx
  iwr -useb https://raw.githubusercontent.com/drdanieldorta/mdia-flw-mcp/main/scripts/install.ps1 | iex   (pede o token)

Parâmetros:
  -Client     claude-code | claude-desktop | cursor | all   (padrão: all)
  -Token      token permanente da API (ou defina $env:FLW_API_KEY)
  -Source     pacote executado via npx (padrão: github:drdanieldorta/mdia-flw-mcp)
  -Messaging  habilita as ferramentas de envio de mensagem
#>
param(
  [ValidateSet("claude-code", "claude-desktop", "cursor", "all")] [string]$Client = "all",
  [string]$Token = $env:FLW_API_KEY,
  [string]$Source = "github:drdanieldorta/mdia-flw-mcp",
  [switch]$Messaging
)
$ErrorActionPreference = "Stop"
$Name = "flw"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js não encontrado. Instale a versão 18 ou superior: https://nodejs.org"
}
$major = [int]((node -p "process.versions.node.split('.')[0]"))
if ($major -lt 18) { Write-Error "Node.js $(node -v) é antigo. Necessário 18 ou superior." }

if (-not $Token) {
  $secure = Read-Host "Cole o token permanente da API (Ajustes > Integrações > Integração via API)" -AsSecureString
  $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if (-not $Token) { Write-Error "Token vazio." }

function Get-ServerConfig {
  $env = @{ FLW_API_KEY = $Token }
  if ($Messaging) { $env.FLW_ENABLE_MESSAGING = "true" }
  return @{ command = "npx"; args = @("-y", $Source); env = $env }
}

function Merge-JsonFile([string]$file) {
  $dir = Split-Path $file -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $cfg = @{}
  if (Test-Path $file) {
    $raw = (Get-Content $file -Raw)
    if ($raw.Trim()) { $cfg = $raw | ConvertFrom-Json -AsHashtable }
  }
  if (-not $cfg.ContainsKey("mcpServers")) { $cfg.mcpServers = @{} }
  $cfg.mcpServers[$Name] = Get-ServerConfig
  ($cfg | ConvertTo-Json -Depth 10) | Set-Content -Path $file -Encoding UTF8
  Write-Host "  atualizado: $file"
}

function Install-ClaudeCode {
  Write-Host "==> Claude Code"
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Warning "  CLI 'claude' não encontrada. Instale com: npm install -g @anthropic-ai/claude-code"; return
  }
  & claude mcp remove $Name -s user 2>$null | Out-Null
  $args = @("mcp", "add", $Name, "-s", "user", "-e", "FLW_API_KEY=$Token")
  if ($Messaging) { $args += @("-e", "FLW_ENABLE_MESSAGING=true") }
  $args += @("--", "npx", "-y", $Source)
  & claude @args
  Write-Host "  registrado no escopo de usuário. Verifique com: claude mcp list"
}

function Install-ClaudeDesktop {
  Write-Host "==> Claude Desktop"
  Merge-JsonFile (Join-Path $env:APPDATA "Claude\claude_desktop_config.json")
  Write-Host "  reinicie o Claude Desktop para carregar o servidor."
}

function Install-Cursor {
  Write-Host "==> Cursor"
  Merge-JsonFile (Join-Path $HOME ".cursor\mcp.json")
  Write-Host "  reinicie o Cursor (ou recarregue os servidores MCP em Settings > MCP)."
}

switch ($Client) {
  "claude-code"    { Install-ClaudeCode }
  "claude-desktop" { Install-ClaudeDesktop }
  "cursor"         { Install-Cursor }
  "all"            { Install-ClaudeCode; Install-ClaudeDesktop; Install-Cursor }
}
Write-Host ""
Write-Host 'Pronto. Teste pedindo ao assistente: "use flw_status para verificar a conexão com o FLW".'
