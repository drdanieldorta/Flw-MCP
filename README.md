# Flw-MCP

Servidor **MCP** para o CRM da MDIA na plataforma **FLW** (Helena / WTS Chat).
Conecta o **Claude Code**, o **Codex CLI**, o Claude Desktop e o Cursor à API do FLW para consultar e atualizar **contatos, etiquetas, carteiras, painéis, cards, sequências e atendimentos**.

---

## Instalação em 2 passos

Pré-requisitos: **Node.js 18+** (https://nodejs.org) e **Git** (https://git-scm.com). No Windows, instale os dois e abra um terminal novo.

### Passo 1: gere o token na plataforma FLW

**Ajustes > Integrações > Integração via API (Configurar) > Novo**. Copie o token (`pn_...`).

> Tokens sem uso por mais de 15 dias são apagados pela plataforma. Se parar de funcionar, gere outro.

### Passo 2: cole um comando no terminal

**Claude Code**
```bash
claude mcp add flw -s user -e FLW_API_KEY=pn_SEU_TOKEN -- npx -y github:drdanieldorta/Flw-MCP
```

**Codex CLI**
```bash
codex mcp add flw --env FLW_API_KEY=pn_SEU_TOKEN -- npx -y github:drdanieldorta/Flw-MCP
```

**No Windows**, troque `npx -y github:...` por `cmd /c npx -y github:drdanieldorta/Flw-MCP` nos dois comandos.

**Teste:** abra o Claude Code ou o Codex e peça *"use flw_status para verificar a conexão com o FLW"*.

A primeira inicialização baixa e compila o servidor (cerca de 20 segundos). As seguintes levam poucos segundos.

---

## Instalador automático (todos os clientes de uma vez)

Registra o servidor no Claude Code, Codex, Claude Desktop e Cursor. Pede o token se não for informado.

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy Bypass -c "$env:FLW_API_KEY='pn_SEU_TOKEN'; iwr -useb https://raw.githubusercontent.com/drdanieldorta/Flw-MCP/HEAD/scripts/install.ps1 | iex"
```

**Linux / macOS**
```bash
curl -fsSL https://raw.githubusercontent.com/drdanieldorta/Flw-MCP/HEAD/scripts/install.sh | bash -s -- --client all --token pn_SEU_TOKEN
```

Opções: `--client claude-code | codex | claude-desktop | cursor | all` e `--messaging` (liga o envio de mensagens). No PowerShell: `-Client` e `-Messaging`.

### Sem Git na máquina

1. No GitHub, clique em **Code > Download ZIP** e extraia.
2. Dentro da pasta extraída:
   - Windows: `powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Client all`
   - Linux / macOS: `./scripts/install.sh --client all`

O instalador compila o projeto e registra o caminho local, sem depender de rede depois.

### Configuração manual (Claude Desktop e Cursor)

Claude Desktop: `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`).
Cursor: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "flw": {
      "command": "npx",
      "args": ["-y", "github:drdanieldorta/Flw-MCP"],
      "env": { "FLW_API_KEY": "pn_SEU_TOKEN" }
    }
  }
}
```
No Windows use `"command": "cmd"` e `"args": ["/c", "npx", "-y", "github:drdanieldorta/Flw-MCP"]`.

Codex CLI, se preferir editar `~/.codex/config.toml`:
```toml
[mcp_servers.flw]
command = "npx"
args = ["-y", "github:drdanieldorta/Flw-MCP"]

[mcp_servers.flw.env]
FLW_API_KEY = "pn_SEU_TOKEN"
```

---

## Releases e npm (opcional, pelo dono do repositório)

Ao enviar uma tag `v*` (`git tag v0.1.0 && git push origin v0.1.0`), o workflow `release.yml` roda os testes, cria um release no GitHub com o pacote `flw-mcp.tgz` anexado e, se o secret `NPM_TOKEN` existir, publica no npm.

Com o release publicado, a instalação dispensa Git:
```bash
claude mcp add flw -s user -e FLW_API_KEY=pn_SEU_TOKEN -- npx -y https://github.com/drdanieldorta/Flw-MCP/releases/latest/download/flw-mcp.tgz
```
Com o pacote no npm, o comando fica apenas `npx -y flw-mcp`.

---

## Configuração (variáveis de ambiente)

| Variável | Obrigatória | Padrão | Função |
|----------|-------------|--------|--------|
| `FLW_API_KEY` | sim | | Token permanente (`pn_...`). `FLW_TOKEN` é aceito como sinônimo. |
| `FLW_BASE_URL` | não | `https://api.helena.run` | URL base. `https://api.flw.chat` e `https://api.wts.chat` são equivalentes. |
| `FLW_ENABLE_MESSAGING` | não | `false` | Liga `flw_send_text` e `flw_send_template` (envio real ao contato). |
| `FLW_ALLOW_RAW_REQUESTS` | não | `false` | Liga `flw_request` (chamada HTTP arbitrária, só para exploração). |
| `FLW_TIMEOUT_MS` | não | `30000` | Timeout por requisição. |
| `FLW_LOG_LEVEL` | não | `info` | `debug` mostra cada requisição no stderr. |

---

## Ferramentas disponíveis

Todas têm prefixo `flw_`. Listagens são paginadas (`pageNumber`, `pageSize` até 100) e aceitam filtros de data em ISO 8601 UTC.

### Diagnóstico
| Ferramenta | O que faz |
|------------|-----------|
| `flw_status` | Mostra a configuração (token mascarado) e testa a autenticação. |
| `flw_request` | Chamada HTTP genérica à API. Só com `FLW_ALLOW_RAW_REQUESTS=true`. |

### Cadastros de apoio
| Ferramenta | O que faz |
|------------|-----------|
| `flw_list_tags` / `flw_create_tag` | Etiquetas da conta. |
| `flw_list_users` | Usuários/atendentes (para `responsibleUserId`). |
| `flw_list_departments` | Equipes. |
| `flw_list_channels` | Canais conectados (WhatsApp, Instagram...). |
| `flw_list_custom_fields` | Definições de campos personalizados de contato ou painel. |
| `flw_list_portfolios` / `flw_list_portfolio_contacts` / `flw_portfolio_contact` | Carteiras e seus contatos. |

### Contatos
| Ferramenta | O que faz |
|------------|-----------|
| `flw_search_contacts` | Busca com filtros (texto, nome, telefone, e-mail, etiquetas, carteiras, status, campos personalizados). |
| `flw_list_contacts` | Listagem simples por status. |
| `flw_get_contact` | Por ID ou telefone. |
| `flw_create_contact` | Cria, com opção de upsert. |
| `flw_update_contact` | Atualiza só os campos informados. |
| `flw_update_contact_tags` | Insere, remove ou substitui etiquetas. |

### CRM (painéis e cards)
| Ferramenta | O que faz |
|------------|-----------|
| `flw_list_panels` | Painéis (funis) com etapas e contagem. |
| `flw_get_panel` | Painel com `stepId` de cada etapa. |
| `flw_list_panel_custom_fields` | Campos personalizados do painel. |
| `flw_list_lost_reasons` | Motivos de perda (painel de Vendas). |
| `flw_list_cards` | Cards por painel, etapa, contato, responsável, texto, status. |
| `flw_get_card` | Card por ID. |
| `flw_create_card` | Cria card em uma etapa. |
| `flw_update_card` | Edita, move de etapa, marca Ganho/Perda, arquiva ou reabre. |
| `flw_duplicate_card` | Duplica card. |
| `flw_list_card_notes` / `flw_add_card_note` | Anotações do card. |

### Sequências
| Ferramenta | O que faz |
|------------|-----------|
| `flw_list_sequences` / `flw_list_sequence_contacts` | Sequências e contatos em execução. |
| `flw_sequence_contacts` | Adiciona ou remove contatos (por ID ou telefone). |

### Atendimentos
| Ferramenta | O que faz |
|------------|-----------|
| `flw_list_sessions` / `flw_get_session` | Conversas com filtros por status, equipe, atendente, contato, canal, datas. |
| `flw_list_session_messages` | Histórico de mensagens de uma conversa. |
| `flw_list_session_notes` / `flw_add_session_note` | Notas internas (invisíveis ao contato). |
| `flw_list_templates` | Modelos de mensagem aprovados. |

### Envio de mensagens (desligado por padrão)
| Ferramenta | O que faz |
|------------|-----------|
| `flw_send_text` | Texto simples ao contato. Requer `FLW_ENABLE_MESSAGING=true`. |
| `flw_send_template` | Modelo aprovado com parâmetros, ou arquivo. Requer `FLW_ENABLE_MESSAGING=true`. |

---

## Fluxos típicos

**Criar um negócio para um contato**
1. `flw_get_contact` (telefone) ou `flw_create_contact` com `upsert: true`
2. `flw_list_panels` com `type: SALES`, depois `flw_get_panel` para pegar o `stepId` da primeira etapa
3. `flw_create_card` com `stepId`, `title`, `contactIds`, `monetaryAmount`

**Marcar negócio como perdido**
1. `flw_list_lost_reasons` com o `panelId`
2. `flw_update_card` com `status: LOST` e `lostReasonId`

**Resumir atendimentos do dia de uma equipe**
1. `flw_list_departments`
2. `flw_list_sessions` com `departmentId` e `createdAfter`
3. `flw_list_session_messages` para cada conversa relevante

---

## Limites e segurança

- **Rate limit da API**: 1.000 requisições a cada 5 minutos e 200 a cada 5 segundos, por conta. O cliente HTTP aplica retry com backoff e respeita `Retry-After` em 429.
- O token dá acesso total à conta. Gere um token por máquina, com nome identificável, para poder revogar isoladamente.
- Envio de mensagens e requisições cruas ficam desligados por padrão, para evitar ações de alto impacto acidentais.
- Logs vão apenas para o stderr (o stdout pertence ao protocolo MCP).

---

## Problemas comuns

| Sintoma | Causa | Solução |
|---------|-------|---------|
| `404` ao baixar o script via `iwr`/`curl` | URL apontando para uma branch inexistente | Use as URLs com `/HEAD/` deste README, que seguem a branch padrão. |
| `npx` trava ou falha ao baixar `github:...` | Git ausente na máquina | Instale o Git ou use o caminho "Sem Git na máquina". |
| `ENOENT npx` no Windows | Clientes MCP não executam `npx.cmd` direto | Use `cmd /c npx ...` (o instalador já faz isso). |
| `ERROR_UNAUTHORIZED` em `flw_status` | Token inválido ou expirado | Gere um novo token na plataforma. |
| `429` | Rate limit | Aguarde; o servidor já refaz a tentativa automaticamente. |

---

## Desenvolvimento

```bash
git clone https://github.com/drdanieldorta/Flw-MCP.git
cd Flw-MCP
npm install
npm test               # build + testes (sem rede, usa servidor HTTP simulado)
npm run inspect        # abre o MCP Inspector contra o servidor compilado
```

```
src/
  index.ts          entrada (transporte stdio)
  server.ts         monta o McpServer e registra as ferramentas
  lib/config.ts     variáveis de ambiente (zod)
  lib/http.ts       cliente HTTP: Bearer, timeout, retry, erros
  lib/schemas.ts    paginação, datas, derivação de `fields`
  lib/result.ts     helpers ok()/fail()/guarded()
  tools/*.ts        um arquivo por domínio; registrados em tools/index.ts
```

Para adicionar um endpoint: edite o arquivo do domínio em `src/tools/`, use `ctx.http` (nunca `fetch` direto), descreva todos os parâmetros com `.describe()` e marque `annotations` (`readOnlyHint`, `destructiveHint`).

Referência da API: https://helena.readme.io/reference
