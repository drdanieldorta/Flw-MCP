# mdia-flw-mcp

Servidor **MCP** para o CRM da MDIA na plataforma **FLW** (Helena / WTS Chat).
Conecta o **Claude Code**, o **Codex CLI**, o Claude Desktop e o Cursor à API do FLW para consultar e atualizar **contatos, etiquetas, carteiras, painéis, cards, sequências e atendimentos**.

---

## Instalação em 2 passos

### Passo 1: gere o token na plataforma FLW

**Ajustes > Integrações > Integração via API (Configurar) > Novo**. Copie o token (`pn_...`).

> Tokens sem uso por mais de 15 dias são apagados pela plataforma. Se parar de funcionar, gere outro.

### Passo 2: cole um comando

Pré-requisito único: **Node.js 18+** instalado (https://nodejs.org).

**Claude Code**
```bash
claude mcp add flw -s user -e FLW_API_KEY=pn_SEU_TOKEN -- npx -y mdia-flw-mcp
```

**Codex CLI**
```bash
codex mcp add flw --env FLW_API_KEY=pn_SEU_TOKEN -- npx -y mdia-flw-mcp
```
Ou edite `~/.codex/config.toml`:
```toml
[mcp_servers.flw]
command = "npx"
args = ["-y", "mdia-flw-mcp"]

[mcp_servers.flw.env]
FLW_API_KEY = "pn_SEU_TOKEN"
```

**Windows (Claude Code ou Codex):** troque `npx -y mdia-flw-mcp` por `cmd /c npx -y mdia-flw-mcp`.

**Teste:** peça ao assistente *"use flw_status para verificar a conexão com o FLW"*.

> **Status do pacote:** os comandos acima dependem do pacote `mdia-flw-mcp` publicado no npm.
> Enquanto a publicação não acontece, use a [instalação a partir do repositório](#instalação-a-partir-do-repositório) abaixo.

---

## Instalação a partir do repositório

Funciona hoje, sem npm, em qualquer máquina com acesso a este repositório. O instalador compila o projeto e registra o servidor no Claude Code, Codex, Claude Desktop e Cursor.

**Windows (PowerShell)**
```powershell
git clone https://github.com/drdanieldorta/mdia-flw-mcp.git
cd mdia-flw-mcp
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Client all
```

**Linux / macOS**
```bash
git clone https://github.com/drdanieldorta/mdia-flw-mcp.git
cd mdia-flw-mcp
./scripts/install.sh --client all
```

O instalador pede o token e registra o servidor como `flw`. Opções: `--client claude-code | codex | claude-desktop | cursor | all` e `--messaging` (liga o envio de mensagens).

Sem Git instalado: baixe o ZIP pelo botão **Code > Download ZIP** no GitHub, extraia e rode o mesmo comando dentro da pasta.

---

## Publicar no npm (uma vez, pelo dono do repositório)

Isso é o que torna a instalação de uma linha possível para qualquer pessoa.

**Opção A, manual**
```bash
npm login
npm publish --access public
```

**Opção B, automática pelo GitHub**
1. Crie um token *Automation* em npmjs.com > Access Tokens.
2. No GitHub: Settings > Secrets and variables > Actions > `NPM_TOKEN`.
3. Publique criando uma tag: `git tag v0.1.0 && git push --tags`. O workflow `publish.yml` roda os testes e publica.

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

Claude Desktop (`claude_desktop_config.json`) e Cursor (`~/.cursor/mcp.json`) usam o mesmo formato:
```json
{
  "mcpServers": {
    "flw": {
      "command": "npx",
      "args": ["-y", "mdia-flw-mcp"],
      "env": { "FLW_API_KEY": "pn_SEU_TOKEN" }
    }
  }
}
```
No Windows use `"command": "cmd"` e `"args": ["/c", "npx", "-y", "mdia-flw-mcp"]`.

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
| `404` ao baixar o script via `iwr`/`curl` | Repositório privado | Clone o repositório e rode o instalador local, ou publique no npm. |
| `ENOENT npx` no Windows | Clientes MCP não executam `npx.cmd` direto | Use `cmd /c npx ...` (o instalador já faz isso). |
| `ERROR_UNAUTHORIZED` em `flw_status` | Token inválido ou expirado | Gere um novo token na plataforma. |
| `429` | Rate limit | Aguarde; o servidor já refaz a tentativa automaticamente. |

---

## Desenvolvimento

```bash
git clone https://github.com/drdanieldorta/mdia-flw-mcp.git
cd mdia-flw-mcp
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
