#!/usr/bin/env bash
# Instalador do flw-mcp para Linux/macOS.
#
# Uso direto da internet (precisa de Node.js 18+ e Git):
#   curl -fsSL https://raw.githubusercontent.com/drdanieldorta/Flw-MCP/HEAD/scripts/install.sh | bash -s -- --client all --token pn_SEU_TOKEN
#
# Uso a partir do repositório clonado (compila e registra dist/index.js; não precisa de rede depois):
#   git clone https://github.com/drdanieldorta/Flw-MCP.git && cd Flw-MCP
#   ./scripts/install.sh --client all
#
# Desinstalar (remove a entrada "flw" de todos os clientes, ou só do --client informado):
#   curl -fsSL https://raw.githubusercontent.com/drdanieldorta/Flw-MCP/HEAD/scripts/install.sh | bash -s -- --uninstall
#
# Opções:
#   --uninstall  remove o servidor dos clientes em vez de instalar
#   --client   claude-code | codex | claude-desktop | cursor | all   (padrão: all)
#   --token    token permanente da API (ou exporte FLW_API_KEY; senão, pergunta)
#   --source   pacote a executar via npx (padrão fora do clone: github:drdanieldorta/Flw-MCP;
#              aceita também flw-mcp após publicar no npm, ou a URL do .tgz de um release)
#   --messaging  habilita as ferramentas de envio de mensagem (FLW_ENABLE_MESSAGING=true)
set -euo pipefail

CLIENT="all"
TOKEN="${FLW_API_KEY:-}"
SOURCE=""
MESSAGING="false"
UNINSTALL="false"
NAME="flw"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uninstall) UNINSTALL="true"; shift ;;
    --client) CLIENT="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --source) SOURCE="$2"; shift 2 ;;
    --messaging) MESSAGING="true"; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 1 ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale a versão 18 ou superior: https://nodejs.org" >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Node.js $(node -v) é antigo. Necessário 18 ou superior." >&2
  exit 1
fi

# --- Desinstalação ------------------------------------------------------------------
remove_json_entry() {
  local file="$1"
  if [[ ! -f "$file" ]]; then echo "  arquivo não existe: $file"; return 0; fi
  node -e '
    const fs = require("fs");
    const [file, name] = process.argv.slice(1);
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").trim();
    if (!raw) { console.log("  arquivo vazio: " + file); process.exit(0); }
    let cfg;
    try { cfg = JSON.parse(raw); } catch (e) { console.error("  JSON inválido em " + file + ": " + e.message); process.exit(1); }
    if (cfg.mcpServers && Object.prototype.hasOwnProperty.call(cfg.mcpServers, name)) {
      delete cfg.mcpServers[name];
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
      console.log("  removido \x27" + name + "\x27 de " + file);
    } else {
      console.log("  \x27" + name + "\x27 não estava em " + file);
    }
  ' "$file" "$NAME"
}

remove_codex_entry() {
  local file="${CODEX_HOME:-$HOME/.codex}/config.toml"
  if [[ ! -f "$file" ]]; then echo "  arquivo não existe: $file"; return 0; fi
  node -e '
    const fs = require("fs");
    const [file, name] = process.argv.slice(1);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const kept = [];
    let skipping = false, removed = false;
    for (const line of lines) {
      const header = line.match(/^\s*\[([^\]]+)\]/);
      if (header) {
        skipping = header[1] === `mcp_servers.${name}` || header[1].startsWith(`mcp_servers.${name}.`);
        if (skipping) removed = true;
      }
      if (!skipping) kept.push(line);
    }
    if (!removed) { console.log("  \x27" + name + "\x27 não estava em " + file); process.exit(0); }
    while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
    fs.writeFileSync(file, kept.length ? kept.join("\n") + "\n" : "");
    console.log("  removido [mcp_servers." + name + "] de " + file);
  ' "$file" "$NAME"
}

uninstall_all() {
  local c="$1"
  if [[ "$c" == "claude-code" || "$c" == "all" ]]; then
    echo "==> Claude Code"
    if command -v claude >/dev/null 2>&1; then
      for scope in user local project; do claude mcp remove "$NAME" -s "$scope" >/dev/null 2>&1 || true; done
      echo "  removido '$NAME' (escopos user, local e project). Confira com: claude mcp list"
    else
      echo "  CLI 'claude' não encontrada; nada a remover."
    fi
  fi
  if [[ "$c" == "codex" || "$c" == "all" ]]; then echo "==> Codex CLI"; remove_codex_entry; fi
  if [[ "$c" == "claude-desktop" || "$c" == "all" ]]; then
    echo "==> Claude Desktop"
    case "$(uname -s)" in
      Darwin) remove_json_entry "$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
      Linux)  remove_json_entry "${XDG_CONFIG_HOME:-$HOME/.config}/Claude/claude_desktop_config.json" ;;
    esac
  fi
  if [[ "$c" == "cursor" || "$c" == "all" ]]; then echo "==> Cursor"; remove_json_entry "$HOME/.cursor/mcp.json"; fi
  echo
  echo "Desinstalação concluída. Para instalar de novo, rode o mesmo script sem --uninstall."
}

if [[ "$UNINSTALL" == "true" ]]; then
  case "$CLIENT" in
    claude-code|codex|claude-desktop|cursor|all) uninstall_all "$CLIENT"; exit 0 ;;
    *) echo "Cliente desconhecido: $CLIENT" >&2; exit 1 ;;
  esac
fi

# --- Modo: local (clone) ou npx (pacote) --------------------------------------
REPO_ROOT=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
COMMAND=""
ARGS=()
if [[ -z "$SOURCE" && -n "$REPO_ROOT" && -f "$REPO_ROOT/package.json" ]]; then
  echo "==> Compilando a partir de $REPO_ROOT"
  (cd "$REPO_ROOT" && npm install --no-audit --no-fund && npm run build)
  COMMAND="node"; ARGS=("$REPO_ROOT/dist/index.js")
else
  SOURCE="${SOURCE:-github:drdanieldorta/Flw-MCP}"
  if [[ "$SOURCE" == github:* || "$SOURCE" == git+* ]] && ! command -v git >/dev/null 2>&1; then
    echo "Git não encontrado e é necessário para instalar de $SOURCE. Instale o Git (https://git-scm.com)" >&2
    echo "ou use --source com a URL do pacote de um release (.tgz)." >&2
    exit 1
  fi
  echo "==> Registrando execução via: npx -y $SOURCE"
  COMMAND="npx"; ARGS=("-y" "$SOURCE")
fi

# --- Token ----------------------------------------------------------------------
if [[ -z "$TOKEN" ]]; then
  if [[ -t 0 ]]; then
    read -r -s -p "Cole o token permanente da API (Ajustes > Integrações > Integração via API): " TOKEN
    echo
  else
    echo "Token não informado. Use --token pn_xxx ou exporte FLW_API_KEY." >&2
    exit 1
  fi
fi
if [[ -z "$TOKEN" ]]; then echo "Token vazio." >&2; exit 1; fi

# Monta o bloco JSON do servidor, usado pelos clientes baseados em arquivo.
server_json() {
  node -e '
    const [command, token, messaging, ...args] = process.argv.slice(1);
    const env = { FLW_API_KEY: token };
    if (messaging === "true") env.FLW_ENABLE_MESSAGING = "true";
    console.log(JSON.stringify({ command, args, env }));
  ' "$COMMAND" "$TOKEN" "$MESSAGING" "${ARGS[@]}"
}

# Insere/atualiza mcpServers.<NAME> em um arquivo JSON, criando-o se preciso.
merge_json_file() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  node -e '
    const fs = require("fs");
    const [file, name, serverJson] = process.argv.slice(1);
    let cfg = {};
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "").trim();
      if (raw) { try { cfg = JSON.parse(raw); } catch (e) { console.error("JSON inválido em " + file + ": " + e.message); process.exit(1); } }
    }
    cfg.mcpServers = cfg.mcpServers || {};
    cfg.mcpServers[name] = JSON.parse(serverJson);
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
    console.log("  atualizado: " + file);
  ' "$file" "$NAME" "$(server_json)"
}

install_claude_code() {
  echo "==> Claude Code"
  if ! command -v claude >/dev/null 2>&1; then
    echo "  CLI 'claude' não encontrada. Instale com: npm install -g @anthropic-ai/claude-code" >&2
    return 1
  fi
  claude mcp remove "$NAME" -s user >/dev/null 2>&1 || true
  local extra=()
  [[ "$MESSAGING" == "true" ]] && extra=(-e FLW_ENABLE_MESSAGING=true)
  claude mcp add "$NAME" -s user -e "FLW_API_KEY=$TOKEN" "${extra[@]}" -- "$COMMAND" "${ARGS[@]}"
  echo "  registrado no escopo de usuário. Verifique com: claude mcp list"
}

# Codex CLI lê ~/.codex/config.toml. Substitui o bloco [mcp_servers.flw] se já existir.
install_codex() {
  echo "==> Codex CLI"
  local file="${CODEX_HOME:-$HOME/.codex}/config.toml"
  mkdir -p "$(dirname "$file")"
  node -e '
    const fs = require("fs");
    const [file, name, command, token, messaging, ...args] = process.argv.slice(1);
    const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
    const kept = [];
    let skipping = false;
    for (const line of lines) {
      const header = line.match(/^\s*\[([^\]]+)\]/);
      if (header) skipping = header[1] === `mcp_servers.${name}` || header[1].startsWith(`mcp_servers.${name}.`);
      if (!skipping) kept.push(line);
    }
    while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
    const block = [
      `[mcp_servers.${name}]`,
      `command = ${JSON.stringify(command)}`,
      `args = ${JSON.stringify(args)}`,
      ``,
      `[mcp_servers.${name}.env]`,
      `FLW_API_KEY = ${JSON.stringify(token)}`,
      ...(messaging === "true" ? [`FLW_ENABLE_MESSAGING = "true"`] : []),
    ];
    const out = (kept.length ? kept.join("\n") + "\n\n" : "") + block.join("\n") + "\n";
    fs.writeFileSync(file, out);
    console.log("  atualizado: " + file);
  ' "$file" "$NAME" "$COMMAND" "$TOKEN" "$MESSAGING" "${ARGS[@]}"
  echo "  abra o Codex e confira com: codex mcp list"
}

install_claude_desktop() {
  echo "==> Claude Desktop"
  local file
  case "$(uname -s)" in
    Darwin) file="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
    Linux)  file="${XDG_CONFIG_HOME:-$HOME/.config}/Claude/claude_desktop_config.json" ;;
    *) echo "  sistema não suportado por este script; use scripts/install.ps1 no Windows." >&2; return 1 ;;
  esac
  merge_json_file "$file"
  echo "  reinicie o Claude Desktop para carregar o servidor."
}

install_cursor() {
  echo "==> Cursor"
  merge_json_file "$HOME/.cursor/mcp.json"
  echo "  reinicie o Cursor (ou recarregue os servidores MCP em Settings > MCP)."
}

status=0
case "$CLIENT" in
  claude-code) install_claude_code || status=1 ;;
  codex) install_codex || status=1 ;;
  claude-desktop) install_claude_desktop || status=1 ;;
  cursor) install_cursor || status=1 ;;
  all)
    install_claude_code || true
    install_codex || true
    install_claude_desktop || true
    install_cursor || true
    ;;
  *) echo "Cliente desconhecido: $CLIENT" >&2; exit 1 ;;
esac

echo
echo "Pronto. Teste pedindo ao assistente: \"use flw_status para verificar a conexão com o FLW\"."
exit $status
