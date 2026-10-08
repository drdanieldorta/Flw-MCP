import { z } from "zod";
import { ok, guarded } from "../lib/result.js";
import { pagingShape, pagingQuery, dateRangeShape, dateQuery, compact, deriveFields, isoDateTime, } from "../lib/schemas.js";
const CARD_FIELD_MAP = {
    stepId: "StepId",
    title: "Title",
    description: "Description",
    position: "Position",
    dueDate: "DueDate",
    responsibleUserId: "ResponsibleUserId",
    tagIds: "TagIds",
    tagNames: "TagIds",
    contactIds: "ContactIds",
    sessionId: "SessionId",
    monetaryAmount: "MonetaryAmount",
    customFields: "CustomFields",
    metadata: "Metadata",
    status: "Status",
};
const cardDetails = z
    .array(z.enum(["PanelTitle", "StepTitle", "StepPhase", "ResponsibleUser", "Contacts", "CustomFields", "LostReason"]))
    .default(["StepTitle", "ResponsibleUser", "Contacts"])
    .describe("Detalhes extras a incluir em cada card.");
const cardDataShape = {
    title: z.string().optional().describe("Título do card."),
    description: z.string().optional(),
    dueDate: isoDateTime.optional().describe("Data de vencimento."),
    responsibleUserId: z.string().optional().describe("ID do usuário responsável (flw_list_users)."),
    tagIds: z.array(z.string()).optional(),
    tagNames: z.array(z.string()).optional().describe("Nomes de etiquetas (ignorado se tagIds informado)."),
    contactIds: z.array(z.string()).optional().describe("IDs dos contatos vinculados ao card."),
    sessionId: z.string().optional().describe("ID do atendimento (conversa) vinculado."),
    monetaryAmount: z.number().optional().describe("Valor da negociação."),
    position: z.number().optional().describe("Posição do card dentro da etapa."),
    customFields: z
        .record(z.unknown())
        .optional()
        .describe("Chave -> valor dos campos personalizados do painel (flw_list_panel_custom_fields)."),
    metadata: z.record(z.unknown()).optional(),
};
/**
 * CRM: painéis (funis), etapas, cards (negócios/tarefas), anotações e motivos de perda.
 * Fluxo típico: flw_list_panels -> flw_get_panel (obter stepIds) -> flw_list_cards / flw_create_card.
 */
export const registerCrmTools = ({ server, http }) => {
    server.registerTool("flw_list_panels", {
        title: "Listar painéis do CRM",
        description: "Lista os painéis (funis) do CRM. Tipo SALES = funil de vendas com Ganho/Perda; MANAGEMENT = gestão/tarefas. " +
            "Inclui as etapas (steps) com seus IDs e contagem de cards.",
        inputSchema: {
            title: z.string().optional().describe("Filtro por título do painel."),
            type: z.enum(["SALES", "MANAGEMENT"]).optional(),
            includeDetails: z
                .array(z.enum(["Tags", "Steps", "StepsCardCount", "PanelCardOverdueCount"]))
                .default(["Steps", "StepsCardCount"]),
            ...pagingShape,
            ...dateRangeShape,
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async (a) => ok((await http.get("/crm/v2/panel", {
        Title: a.title,
        Type: a.type,
        IncludeDetails: a.includeDetails,
        ...pagingQuery(a),
        ...dateQuery(a),
    })).data)));
    server.registerTool("flw_get_panel", {
        title: "Obter painel com etapas",
        description: "Obtém um painel pelo ID com suas etapas (stepId, título, inicial/final, contagem e valor por etapa) e etiquetas. " +
            "Use para descobrir o stepId antes de criar ou mover cards.",
        inputSchema: {
            panelId: z.string().describe("ID do painel."),
            includeDetails: z
                .array(z.enum(["Tags", "Steps", "StepsFields", "StepsCardCount", "Cards"]))
                .default(["Steps", "StepsCardCount", "Tags"]),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async ({ panelId, includeDetails }) => ok((await http.get(`/crm/v1/panel/${encodeURIComponent(panelId)}`, { IncludeDetails: includeDetails })).data)));
    server.registerTool("flw_list_panel_custom_fields", {
        title: "Listar campos personalizados de um painel",
        description: "Lista as definições de campos personalizados dos cards de um painel (chaves para 'customFields').",
        inputSchema: {
            panelId: z.string(),
            nestedList: z.boolean().default(false),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async ({ panelId, nestedList }) => ok((await http.get(`/crm/v1/panel/${encodeURIComponent(panelId)}/custom-fields`, { NestedList: nestedList }))
        .data)));
    server.registerTool("flw_list_lost_reasons", {
        title: "Listar motivos de perda",
        description: "Lista os motivos de perda cadastrados em um painel de Vendas (SALES). Necessário para marcar um card como LOST.",
        inputSchema: { panelId: z.string(), ...pagingShape },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async (a) => ok((await http.get(`/crm/v1/panel/${encodeURIComponent(a.panelId)}/lost-reason`, pagingQuery(a))).data)));
    server.registerTool("flw_list_cards", {
        title: "Listar cards de um painel",
        description: "Lista paginada de cards (negócios/tarefas) de um painel, com filtros por etapa, contato, responsável, " +
            "texto, status (OPEN, WON, LOST, ARCHIVED) e datas. Por padrão traz apenas cards OPEN.",
        inputSchema: {
            panelId: z.string().describe("ID do painel (obrigatório)."),
            stepId: z.string().optional().describe("Filtra por etapa."),
            contactId: z.string().optional(),
            responsibleUserId: z.string().optional(),
            textFilter: z.string().optional().describe("Busca livre no título/descrição."),
            statuses: z.array(z.enum(["OPEN", "WON", "LOST", "ARCHIVED"])).default(["OPEN"]),
            includeDetails: cardDetails,
            ...pagingShape,
            ...dateRangeShape,
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async (a) => ok((await http.get("/crm/v2/panel/card", {
        PanelId: a.panelId,
        StepId: a.stepId,
        ContactId: a.contactId,
        ResponsibleUserId: a.responsibleUserId,
        TextFilter: a.textFilter,
        Statuses: a.statuses,
        IncludeDetails: a.includeDetails,
        ...pagingQuery(a),
        ...dateQuery(a),
    })).data)));
    server.registerTool("flw_get_card", {
        title: "Obter card",
        description: "Obtém um card pelo ID, com etapa, responsável, contatos, campos personalizados e motivo de perda.",
        inputSchema: {
            cardId: z.string(),
            includeDetails: cardDetails.default([
                "PanelTitle", "StepTitle", "StepPhase", "ResponsibleUser", "Contacts", "CustomFields", "LostReason",
            ]),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async ({ cardId, includeDetails }) => ok((await http.get(`/crm/v2/panel/card/${encodeURIComponent(cardId)}`, { IncludeDetails: includeDetails })).data)));
    server.registerTool("flw_create_card", {
        title: "Criar card",
        description: "Cria um card (negócio ou tarefa) em uma etapa de um painel. Obtenha o stepId com flw_get_panel. " +
            "Vincule contatos por contactIds para o card aparecer no atendimento.",
        inputSchema: {
            ...cardDataShape,
            stepId: z.string().describe("ID da etapa onde o card entra."),
            title: z.string().min(1).describe("Título do card."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, guarded(async (a) => ok((await http.post("/crm/v2/panel/card", compact(a))).data)));
    server.registerTool("flw_update_card", {
        title: "Atualizar ou mover card",
        description: "Atualiza somente os campos informados de um card. Use stepId para mover de etapa; status WON/LOST para " +
            "encerrar negociação em painel de Vendas (LOST exige lostReasonId, veja flw_list_lost_reasons); " +
            "status ARCHIVED arquiva; status OPEN reabre.",
        inputSchema: {
            cardId: z.string(),
            stepId: z.string().optional().describe("Nova etapa (mover)."),
            ...cardDataShape,
            status: z.enum(["OPEN", "WON", "LOST", "ARCHIVED"]).optional(),
            lostReasonId: z.string().optional().describe("Obrigatório quando status = LOST."),
            tagOperation: z.enum(["InsertIfNotExists", "DeleteIfExists", "ReplaceAll"]).default("InsertIfNotExists"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, guarded(async ({ cardId, tagOperation, lostReasonId, ...data }) => {
        const payload = compact({ ...data, lostReasonId });
        const fields = deriveFields(payload, CARD_FIELD_MAP);
        if (fields.length === 0)
            throw new Error("Nenhum campo para atualizar foi informado.");
        if (data.status === "LOST" && !lostReasonId) {
            throw new Error("status LOST exige lostReasonId (use flw_list_lost_reasons).");
        }
        const body = { fields, ...payload, options: { upsertTagOperation: tagOperation } };
        return ok((await http.put(`/crm/v3/panel/card/${encodeURIComponent(cardId)}`, body)).data);
    }));
    server.registerTool("flw_duplicate_card", {
        title: "Duplicar card",
        description: "Cria uma cópia de um card, opcionalmente em outra etapa/painel e arquivando o original.",
        inputSchema: {
            cardId: z.string(),
            copyToStepId: z.string().optional().describe("Etapa de destino (mesmo ou outro painel). Vazio mantém a etapa."),
            archiveOriginalCard: z.boolean().default(false),
            fields: z
                .array(z.enum(["All", "Amount", "DueDate", "Tags", "MonetaryAmount", "Contacts", "ResponsibleUser", "CustomFields", "Notes"]))
                .optional()
                .describe("O que copiar. Vazio copia tudo."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, guarded(async ({ cardId, copyToStepId, archiveOriginalCard, fields }) => ok((await http.post(`/crm/v2/panel/card/${encodeURIComponent(cardId)}/duplicate`, {
        copyToStepId,
        options: compact({ archiveOriginalCard, fields }),
    })).data)));
    server.registerTool("flw_list_card_notes", {
        title: "Listar anotações de um card",
        description: "Lista as anotações (histórico interno) de um card.",
        inputSchema: { cardId: z.string(), ...pagingShape, ...dateRangeShape },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async (a) => ok((await http.get(`/crm/v1/panel/card/${encodeURIComponent(a.cardId)}/note`, {
        ...pagingQuery(a),
        ...dateQuery(a),
    })).data)));
    server.registerTool("flw_add_card_note", {
        title: "Adicionar anotação a um card",
        description: "Registra uma anotação interna no card (texto e/ou URLs públicas de arquivos).",
        inputSchema: {
            cardId: z.string(),
            text: z.string().optional(),
            fileUrls: z.array(z.string().url()).optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, guarded(async ({ cardId, text, fileUrls }) => {
        if (!text && !fileUrls?.length)
            throw new Error("Informe text ou fileUrls.");
        return ok((await http.post(`/crm/v1/panel/card/${encodeURIComponent(cardId)}/note`, compact({ text, fileUrls }))).data);
    }));
};
