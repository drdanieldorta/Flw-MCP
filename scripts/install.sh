#!/usr/bin/env bash
# Instalador do mdia-flw-mcp para Linux/macOS.
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/drdanieldorta/mdia-flw-mcp/main/scripts/install.sh | bash -s -- --client claude-code
#   ./scripts/install.sh --client claude-desktop --token pn_xxx
#
# Opções:
#   --client   claude-code | claude-desktop | cursor | all   (padrão: all)
#   --token    token permanente da API (ou exporte FLW_API_KEY antes)
#   --source   pacote a executar com npx (padrão: github:drdanieldorta/mdia-flw-mcp)
#   --messaging  habilita as ferramentas de envio de mensagem (FLW_ENABLE_MESSAGING=true)
set -euo pipefail

CLIENT="all"
TOKEN="${FLW_API_KEY:-}"
SOURCE="github:drdanieldorta/mdia-flw-mcp"
MESSAGING="false"
NAME="flw"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --client) CLIENT="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --source) SOURCE="$2"; shift 2 ;;
    --messaging) MESSAGING="true"; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
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
    const [source, token, messaging] = process.argv.slice(1);
    const env = { FLW_API_KEY: token };
    if (messaging === "true") env.FLW_ENABLE_MESSAGING = "true";
    console.log(JSON.stringify({ command: "npx", args: ["-y", source], env }));
  ' "$SOURCE" "$TOKEN" "$MESSAGING"
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
      const raw = fs.readFileSync(file, "utf8").trim();
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
  claude mcp add "$NAME" -s user -e "FLW_API_KEY=$TOKEN" "${extra[@]}" -- npx -y "$SOURCE"
  echo "  registrado no escopo de usuário. Verifique com: claude mcp list"
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
  claude-desktop) install_claude_desktop || status=1 ;;
  cursor) install_cursor || status=1 ;;
  all)
    install_claude_code || true
    install_claude_desktop || true
    install_cursor || true
    ;;
  *) echo "Cliente desconhecido: $CLIENT" >&2; exit 1 ;;
esac

echo
echo "Pronto. Teste pedindo ao assistente: \"use flw_status para verificar a conexão com o FLW\"."
exit $status
