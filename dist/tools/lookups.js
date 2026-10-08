import { z } from "zod";
import { ok, guarded } from "../lib/result.js";
import { pagingShape, pagingQuery, dateRangeShape, dateQuery, compact } from "../lib/schemas.js";
const TAG_COLORS = [
    "BROWN", "PURPLE", "PINK", "RED", "YELLOW", "GREEN", "BLUE", "SKY", "GRAY",
].flatMap((c) => ["100", "200", "300", "400", "500", "600"].map((n) => `${c}_${n}`));
/**
 * Cadastros de apoio: etiquetas, usuários, equipes, canais, campos
 * personalizados e carteiras. Em geral são o primeiro passo para obter IDs
 * usados pelas demais ferramentas.
 */
export const registerLookupTools = ({ server, http }) => {
    server.registerTool("flw_list_tags", {
        title: "Listar etiquetas",
        description: "Lista todas as etiquetas da conta (id, nome, cor). Use para descobrir IDs/nomes antes de " +
            "filtrar contatos ou aplicar etiquetas.",
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async () => ok((await http.get("/core/v1/tag")).data)));
    server.registerTool("flw_create_tag", {
        title: "Criar etiqueta",
        description: "Cria uma etiqueta na conta. Sem cor, usa GRAY_600.",
        inputSchema: {
            name: z.string().min(1).describe("Nome da etiqueta."),
            color: z.enum(TAG_COLORS).optional().describe("Cor da paleta, ex.: GREEN_500."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, guarded(async ({ name, color }) => ok((await http.post("/core/v1/tag", compact({ name, color }))).data)));
    server.registerTool("flw_list_users", {
        title: "Listar usuários (atendentes)",
        description: "Lista os usuários/atendentes da conta, com id, nome, e-mail e disponibilidade. " +
            "Use para obter responsibleUserId de cards ou userId de atendimentos.",
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async () => ok((await http.get("/core/v1/agent")).data)));
    server.registerTool("flw_list_departments", {
        title: "Listar equipes",
        description: "Lista as equipes (departamentos) da conta, com id e nome.",
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async () => ok((await http.get("/core/v2/department")).data)));
    server.registerTool("flw_list_channels", {
        title: "Listar canais de atendimento",
        description: "Lista os canais conectados (WhatsApp, Instagram, Messenger, WebChat) com id e número. " +
            "Necessário para escolher o remetente ('from') em envios de mensagem.",
        inputSchema: {
            channelType: z.enum(["All", "Whatsapp", "Messenger", "Instagram", "WebChat"]).default("All"),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async ({ channelType }) => ok((await http.get("/chat/v1/channel", { ChannelType: channelType })).data)));
    server.registerTool("flw_list_custom_fields", {
        title: "Listar campos personalizados",
        description: "Lista as definições de campos personalizados de contatos (CONTACT) ou de painéis do CRM (PANEL). " +
            "Use para saber as chaves aceitas em 'customFields' ao criar/atualizar contatos e cards.",
        inputSchema: {
            entityType: z.enum(["CONTACT", "PANEL"]).describe("Entidade dona dos campos."),
            nestedList: z.boolean().default(false).describe("true retorna a estrutura aninhada (grupos)."),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async ({ entityType, nestedList }) => ok((await http.get("/core/v1/custom-field", { EntityType: entityType, NestedList: nestedList })).data)));
    server.registerTool("flw_list_portfolios", {
        title: "Listar carteiras",
        description: "Lista as carteiras (vínculo contato -> equipe/atendente responsável), com equipes e contagem de contatos.",
        inputSchema: { ...pagingShape, ...dateRangeShape },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async (a) => ok((await http.get("/core/v1/portfolio", {
        IncludeDetails: ["Departments", "ContactCount"],
        ...pagingQuery(a),
        ...dateQuery(a),
    })).data)));
    server.registerTool("flw_list_portfolio_contacts", {
        title: "Listar contatos de uma carteira",
        description: "Lista os contatos vinculados a uma carteira específica.",
        inputSchema: {
            portfolioId: z.string().describe("ID da carteira (veja flw_list_portfolios)."),
            page: z.number().int().min(1).default(1),
            pageSize: z.number().int().min(1).max(100).default(20),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async ({ portfolioId, page, pageSize }) => ok((await http.get(`/core/v1/portfolio/${encodeURIComponent(portfolioId)}/contact`, {
        Page: page,
        PageSize: pageSize,
    })).data)));
    server.registerTool("flw_portfolio_contact", {
        title: "Adicionar ou remover contato de uma carteira",
        description: "Vincula (add) ou desvincula (remove) um contato de uma carteira. Informe contactId ou phoneNumber. " +
            "Regra da plataforma: um contato não pode estar em duas carteiras da mesma equipe.",
        inputSchema: {
            action: z.enum(["add", "remove"]),
            portfolioId: z.string().describe("ID da carteira."),
            contactId: z.string().optional().describe("ID do contato."),
            phoneNumber: z.string().optional().describe("Telefone do contato, alternativa ao ID."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, guarded(async ({ action, portfolioId, contactId, phoneNumber }) => {
        if (!contactId && !phoneNumber)
            throw new Error("Informe contactId ou phoneNumber.");
        const path = `/core/v1/portfolio/${encodeURIComponent(portfolioId)}/contact`;
        const body = compact({ contactId, phoneNumber });
        const res = action === "add" ? await http.post(path, body) : await http.delete(path, body);
        return ok(res.data ?? { ok: true, action, portfolioId });
    }));
};
