# mdia-flw-mcp

Servidor **MCP (Model Context Protocol)** para o CRM da MDIA na plataforma **FLW** (white-label de Helena / WTS Chat).
Permite que Claude Desktop, Claude Code, Cursor e qualquer cliente MCP consultem e atualizem **contatos, etiquetas, carteiras, painéis, cards, sequências e atendimentos** usando a API pública da plataforma.

Instalação em um comando, em qualquer máquina com Node.js 18+.

---

## 1. Pré-requisitos

| Item | Como obter |
|------|------------|
| Node.js 18 ou superior | https://nodejs.org |
| Token permanente da API | Na plataforma: **Ajustes > Integrações > Integração via API (Configurar) > Novo**. Formato `pn_...` |

> Tokens sem uso por mais de 15 dias são excluídos automaticamente pela plataforma. Se parar de funcionar, gere um novo.

---

## 2. Instalação rápida

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/drdanieldorta/mdia-flw-mcp/main/scripts/install.sh | bash -s -- --client all --token pn_SEU_TOKEN
```

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/drdanieldorta/mdia-flw-mcp/main/scripts/install.ps1 | iex"
```

Opções: `--client claude-code | claude-desktop | cursor | all` e `--messaging` (habilita envio de mensagens).

O instalador registra o servidor como `flw`, executado via `npx -y github:drdanieldorta/mdia-flw-mcp`. Nada é instalado globalmente.

---

## 3. Instalação manual por cliente

### Claude Code

```bash
claude mcp add flw -s user -e FLW_API_KEY=pn_SEU_TOKEN -- npx -y github:drdanieldorta/mdia-flw-mcp
```

### Claude Desktop

Arquivo `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "flw": {
      "command": "npx",
      "args": ["-y", "github:drdanieldorta/mdia-flw-mcp"],
      "env": { "FLW_API_KEY": "pn_SEU_TOKEN" }
    }
  }
}
```

### Cursor

Arquivo `~/.cursor/mcp.json` (ou `.cursor/mcp.json` no projeto) com o mesmo bloco acima.

### Teste

Peça ao assistente: *"use flw_status para verificar a conexão com o FLW"*.

---

## 4. Variáveis de ambiente

| Variável | Obrigatória | Padrão | Função |
|----------|-------------|--------|--------|
| `FLW_API_KEY` | sim | | Token permanente (`pn_...`). `FLW_TOKEN` é aceito como sinônimo. |
| `FLW_BASE_URL` | não | `https://api.helena.run` | URL base. `https://api.flw.chat` e `https://api.wts.chat` são equivalentes. |
| `FLW_ENABLE_MESSAGING` | não | `false` | Liga `flw_send_text` e `flw_send_template` (envio real ao contato). |
| `FLW_ALLOW_RAW_REQUESTS` | não | `false` | Liga `flw_request` (chamada HTTP arbitrária, só para exploração). |
| `FLW_TIMEOUT_MS` | não | `30000` | Timeout por requisição. |
| `FLW_LOG_LEVEL` | não | `info` | `debug` mostra cada requisição no stderr. |

---

## 5. Ferramentas disponíveis

Todas as ferramentas têm prefixo `flw_`. Listagens são paginadas (`pageNumber`, `pageSize` até 100) e aceitam filtros de data em ISO 8601 UTC.

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
| `flw_update_contact` | Atualiza só os campos informados (o array `fields` da API é derivado automaticamente). |
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

## 6. Fluxos típicos

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

## 7. Limites e segurança

- **Rate limit da API**: 1.000 requisições a cada 5 minutos e 200 a cada 5 segundos, por conta. O cliente HTTP aplica retry com backoff e respeita `Retry-After` em 429.
- O token dá acesso total à conta. Guarde-o só na configuração do cliente MCP, nunca em arquivos versionados.
- Envio de mensagens e requisições cruas ficam desligados por padrão, exatamente para evitar ações de alto impacto acidentais.
- Logs vão apenas para o stderr (o stdout pertence ao protocolo MCP).

---

## 8. Desenvolvimento

```bash
git clone https://github.com/drdanieldorta/mdia-flw-mcp.git
cd mdia-flw-mcp
npm install
cp .env.example .env   # preencha FLW_API_KEY
npm test               # build + testes (sem rede, usa servidor HTTP simulado)
npm run inspect        # abre o MCP Inspector contra o servidor compilado
```

Estrutura:

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

Para adicionar um endpoint: crie ou edite o arquivo do domínio em `src/tools/`, use `ctx.http` (nunca `fetch` direto), descreva todos os parâmetros com `.describe()` e marque `annotations` (`readOnlyHint`, `destructiveHint`).

Referência da API: https://helena.readme.io/reference

---

## 9. Publicação (opcional, deixa a instalação mais rápida)

Hoje o `npx` instala direto do GitHub e compila na primeira execução (requer acesso ao repositório se ele for privado). Publicar no npm elimina a compilação local:

```bash
npm version patch
npm publish --access public
```

Depois troque `github:drdanieldorta/mdia-flw-mcp` por `mdia-flw-mcp` nos comandos de instalação.
