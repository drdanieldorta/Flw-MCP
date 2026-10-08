<#
Instalador do flw-mcp para Windows (PowerShell 5.1 ou superior).

Uso direto da internet (precisa de Node.js 18+ e Git):
  powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/drdanieldorta/Flw-MCP/HEAD/scripts/install.ps1 | iex"

Uso a partir do repositório clonado (compila e registra dist\index.js; não precisa de rede depois):
  git clone https://github.com/drdanieldorta/Flw-MCP.git ; cd Flw-MCP
  powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Client all

Desinstalar (remove a entrada "flw" de todos os clientes, ou só do -Client informado):
  & ([scriptblock]::Create((iwr -useb https://raw.githubusercontent.com/drdanieldorta/Flw-MCP/HEAD/scripts/install.ps1).Content)) -Uninstall
  powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Uninstall

Parâmetros:
  -Uninstall  remove o servidor dos clientes em vez de instalar
  -Client     claude-code | codex | claude-desktop | cursor | all   (padrão: all)
  -Token      token permanente da API (ou defina $env:FLW_API_KEY; senão, pergunta)
  -Source     pacote a executar via npx (padrão fora do clone: github:drdanieldorta/Flw-MCP;
              aceita também flw-mcp após publicar no npm, ou a URL do .tgz de um release)
  -Messaging  habilita as ferramentas de envio de mensagem
#>
param(
  [ValidateSet("claude-code", "codex", "claude-desktop", "cursor", "all")] [string]$Client = "all",
  [string]$Token = $env:FLW_API_KEY,
  [string]$Source = "",
  [switch]$Messaging,
  [switch]$Uninstall
)
$ErrorActionPreference = "Stop"
$Name = "flw"

# Executa um programa externo sem que mensagens no stderr virem erro fatal
# (comportamento do PowerShell 5.1 com ErrorActionPreference = Stop).
# Retorna o código de saída. Com -Quiet, descarta toda a saída.
function Invoke-Native {
  param([string]$Exe, [string[]]$ArgList = @(), [switch]$Quiet)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($Quiet) { & $Exe @ArgList 2>&1 | Out-Null } else { & $Exe @ArgList }
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
}

# --- Desinstalação -------------------------------------------------------------
function Remove-FromJsonFile([string]$file) {
  if (-not (Test-Path $file)) { Write-Host "  arquivo não existe: $file"; return }
  $raw = Get-Content $file -Raw
  if (-not $raw -or -not $raw.Trim()) { Write-Host "  arquivo vazio: $file"; return }
  $cfg = $raw | ConvertFrom-Json
  if (($cfg.PSObject.Properties.Name -contains "mcpServers") -and ($cfg.mcpServers.PSObject.Properties.Name -contains $Name)) {
    $cfg.mcpServers.PSObject.Properties.Remove($Name)
    $json = $cfg | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($file, $json + "`n", (New-Object System.Text.UTF8Encoding $false))
    Write-Host "  removido '$Name' de $file"
  } else {
    Write-Host "  '$Name' não estava em $file"
  }
}

function Remove-FromCodexToml {
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
  $file = Join-Path $codexHome "config.toml"
  if (-not (Test-Path $file)) { Write-Host "  arquivo não existe: $file"; return }
  $kept = New-Object System.Collections.Generic.List[string]
  $removed = $false
  $skipping = $false
  foreach ($line in (Get-Content $file)) {
    if ($line -match '^\s*\[([^\]]+)\]') {
      $section = $Matches[1]
      $skipping = ($section -eq "mcp_servers.$Name") -or $section.StartsWith("mcp_servers.$Name.")
      if ($skipping) { $removed = $true }
    }
    if (-not $skipping) { $kept.Add($line) }
  }
  if ($removed) {
    while ($kept.Count -gt 0 -and $kept[$kept.Count - 1].Trim() -eq "") { $kept.RemoveAt($kept.Count - 1) }
    $text = ""
    if ($kept.Count -gt 0) { $text = ($kept -join "`n") + "`n" }
    [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "  removido '[mcp_servers.$Name]' de $file"
  } else {
    Write-Host "  '$Name' não estava em $file"
  }
}

function Uninstall-ClaudeCode {
  Write-Host "==> Claude Code"
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Write-Host "  CLI 'claude' não encontrada; nada a remover."; return }
  foreach ($scope in @("user", "local", "project")) {
    [void](Invoke-Native "claude" @("mcp", "remove", $Name, "-s", $scope) -Quiet)
  }
  Write-Host "  removido '$Name' (escopos user, local e project). Confira com: claude mcp list"
}

function Uninstall-Codex {
  Write-Host "==> Codex CLI"
  Remove-FromCodexToml
}

function Uninstall-ClaudeDesktop {
  Write-Host "==> Claude Desktop"
  Remove-FromJsonFile (Join-Path $env:APPDATA "Claude\claude_desktop_config.json")
  Write-Host "  feche o Claude Desktop pela bandeja do sistema e abra de novo."
}

function Uninstall-Cursor {
  Write-Host "==> Cursor"
  Remove-FromJsonFile (Join-Path $HOME ".cursor\mcp.json")
}

if ($Uninstall) {
  switch ($Client) {
    "claude-code"    { Uninstall-ClaudeCode }
    "codex"          { Uninstall-Codex }
    "claude-desktop" { Uninstall-ClaudeDesktop }
    "cursor"         { Uninstall-Cursor }
    "all"            { Uninstall-ClaudeCode; Uninstall-Codex; Uninstall-ClaudeDesktop; Uninstall-Cursor }
  }
  Write-Host ""
  Write-Host "Desinstalação concluída. Para instalar de novo, rode o mesmo script sem -Uninstall."
  exit 0
}

# --- Pré-requisitos ---------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js não encontrado. Instale a versão 18 ou superior: https://nodejs.org"
}
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) { throw "Node.js $(node -v) é antigo. Necessário 18 ou superior." }

# --- Modo: local (clone) ou npx (pacote) ------------------------------------
$RepoRoot = ""
if ($PSScriptRoot) { $RepoRoot = Split-Path $PSScriptRoot -Parent }
$LocalMode = $false
if (-not $Source) {
  if ($RepoRoot -and (Test-Path (Join-Path $RepoRoot "package.json"))) {
    $LocalMode = $true
  } else {
    $Source = "github:drdanieldorta/Flw-MCP"
  }
}
if (-not $LocalMode -and ($Source.StartsWith("github:") -or $Source.StartsWith("git+")) -and -not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git não encontrado e é necessário para instalar de $Source. Instale o Git (https://git-scm.com) ou use -Source com a URL do pacote de um release (.tgz)."
}

if ($LocalMode) {
  Write-Host "==> Compilando a partir de $RepoRoot"
  Push-Location $RepoRoot
  try {
    $code = Invoke-Native "npm" @("install", "--no-audit", "--no-fund")
    if ($code -ne 0) { throw "npm install falhou (código $code)" }
    $code = Invoke-Native "npm" @("run", "build")
    if ($code -ne 0) { throw "npm run build falhou (código $code)" }
  } finally { Pop-Location }
  $Entry = Join-Path $RepoRoot "dist\index.js"
  $Command = "node"
  [string[]]$CmdArgs = @($Entry)
} else {
  Write-Host "==> Registrando execução via: npx -y $Source"
  # No Windows, clientes MCP não conseguem executar npx.cmd diretamente; use cmd /c.
  $Command = "cmd"
  [string[]]$CmdArgs = @("/c", "npx", "-y", $Source)
  Write-Host "==> Baixando o servidor agora (evita timeout na primeira conexão do cliente)..."
  $code = Invoke-Native "cmd" @("/c", "npx", "-y", $Source, "--version")
  if ($code -ne 0) { Write-Warning "  não consegui pré-baixar; a primeira conexão pode demorar mais que o normal." }
}

# --- Token -------------------------------------------------------------------
if (-not $Token) {
  $secure = Read-Host "Cole o token permanente da API (Ajustes > Integrações > Integração via API)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not $Token) { throw "Token vazio." }

# --- Helpers de JSON (compatíveis com PowerShell 5.1) ----------------------
function New-ServerObject {
  $envObj = New-Object PSObject
  $envObj | Add-Member -MemberType NoteProperty -Name FLW_API_KEY -Value $Token
  if ($Messaging) { $envObj | Add-Member -MemberType NoteProperty -Name FLW_ENABLE_MESSAGING -Value "true" }
  $obj = New-Object PSObject
  $obj | Add-Member -MemberType NoteProperty -Name command -Value $Command
  $obj | Add-Member -MemberType NoteProperty -Name args -Value $CmdArgs
  $obj | Add-Member -MemberType NoteProperty -Name env -Value $envObj
  return $obj
}

function Merge-JsonFile([string]$file) {
  $dir = Split-Path $file -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $cfg = New-Object PSObject
  if (Test-Path $file) {
    $raw = Get-Content $file -Raw
    if ($raw -and $raw.Trim()) { $cfg = $raw | ConvertFrom-Json }
  }
  if (-not ($cfg.PSObject.Properties.Name -contains "mcpServers")) {
    $cfg | Add-Member -MemberType NoteProperty -Name mcpServers -Value (New-Object PSObject)
  }
  if ($cfg.mcpServers.PSObject.Properties.Name -contains $Name) {
    $cfg.mcpServers.$Name = New-ServerObject
  } else {
    $cfg.mcpServers | Add-Member -MemberType NoteProperty -Name $Name -Value (New-ServerObject)
  }
  $json = $cfg | ConvertTo-Json -Depth 10
  # Sem BOM: o Node (e os clientes MCP) rejeitam JSON com BOM.
  [System.IO.File]::WriteAllText($file, $json + "`n", (New-Object System.Text.UTF8Encoding $false))
  Write-Host "  atualizado: $file"
}

# --- Clientes ----------------------------------------------------------------
function Install-ClaudeCode {
  Write-Host "==> Claude Code"
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Warning "  CLI 'claude' não encontrada. Instale com: npm install -g @anthropic-ai/claude-code"
    return
  }
  [void](Invoke-Native "claude" @("mcp", "remove", $Name, "-s", "user") -Quiet)
  $cli = @("mcp", "add", $Name, "-s", "user", "-e", "FLW_API_KEY=$Token")
  if ($Messaging) { $cli += @("-e", "FLW_ENABLE_MESSAGING=true") }
  $cli += @("--", $Command) + $CmdArgs
  $code = Invoke-Native "claude" $cli
  if ($code -ne 0) { throw "claude mcp add falhou (código $code)" }
  Write-Host "  registrado no escopo de usuário. Verifique com: claude mcp list"
}

function ConvertTo-TomlString([string]$s) {
  return '"' + $s.Replace('\', '\\').Replace('"', '\"') + '"'
}

# Codex CLI lê %USERPROFILE%\.codex\config.toml. Substitui o bloco [mcp_servers.flw] se já existir.
function Install-Codex {
  Write-Host "==> Codex CLI"
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
  $file = Join-Path $codexHome "config.toml"
  if (-not (Test-Path $codexHome)) { New-Item -ItemType Directory -Path $codexHome -Force | Out-Null }
  $kept = New-Object System.Collections.Generic.List[string]
  if (Test-Path $file) {
    $skipping = $false
    foreach ($line in (Get-Content $file)) {
      if ($line -match '^\s*\[([^\]]+)\]') {
        $section = $Matches[1]
        $skipping = ($section -eq "mcp_servers.$Name") -or $section.StartsWith("mcp_servers.$Name.")
      }
      if (-not $skipping) { $kept.Add($line) }
    }
  }
  while ($kept.Count -gt 0 -and $kept[$kept.Count - 1].Trim() -eq "") { $kept.RemoveAt($kept.Count - 1) }
  $argList = ($CmdArgs | ForEach-Object { ConvertTo-TomlString $_ }) -join ", "
  $block = @(
    "[mcp_servers.$Name]",
    "command = $(ConvertTo-TomlString $Command)",
    "args = [$argList]",
    "startup_timeout_sec = 60",
    "",
    "[mcp_servers.$Name.env]",
    "FLW_API_KEY = $(ConvertTo-TomlString $Token)"
  )
  if ($Messaging) { $block += 'FLW_ENABLE_MESSAGING = "true"' }
  $text = ""
  if ($kept.Count -gt 0) { $text = ($kept -join "`n") + "`n`n" }
  $text += ($block -join "`n") + "`n"
  [System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "  atualizado: $file"
  Write-Host "  abra o Codex e confira com: codex mcp list"
}

function Install-ClaudeDesktop {
  Write-Host "==> Claude Desktop"
  Merge-JsonFile (Join-Path $env:APPDATA "Claude\claude_desktop_config.json")
  Write-Host "  feche o Claude Desktop pela bandeja do sistema e abra de novo para carregar o servidor."
}

function Install-Cursor {
  Write-Host "==> Cursor"
  Merge-JsonFile (Join-Path $HOME ".cursor\mcp.json")
  Write-Host "  reinicie o Cursor (ou recarregue os servidores MCP em Settings > MCP)."
}

switch ($Client) {
  "claude-code"    { Install-ClaudeCode }
  "codex"          { Install-Codex }
  "claude-desktop" { Install-ClaudeDesktop }
  "cursor"         { Install-Cursor }
  "all"            { Install-ClaudeCode; Install-Codex; Install-ClaudeDesktop; Install-Cursor }
}
Write-Host ""
Write-Host 'Pronto. Teste pedindo ao assistente: "use flw_status para verificar a conexão com o FLW".'
