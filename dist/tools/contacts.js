import { z } from "zod";
import { ok, guarded } from "../lib/result.js";
import { pagingShape, pagingQuery, dateRangeShape, dateQuery, compact, deriveFields, } from "../lib/schemas.js";
const CONTACT_FIELD_MAP = {
    name: "Name",
    phoneNumber: "PhoneNumber",
    email: "Email",
    instagram: "Instagram",
    annotation: "Annotation",
    tagIds: "Tags",
    tagNames: "Tags",
    status: "Status",
    pictureUrl: "PictureUrl",
    portfolioIds: "Portfolio",
    portfolioNames: "Portfolio",
    sequenceIds: "SequenceIds",
    customFields: "CustomFields",
    metadata: "Metadata",
};
const contactDataShape = {
    name: z.string().optional().describe("Nome do contato."),
    phoneNumber: z.string().optional().describe("Número de WhatsApp com DDI, ex.: 5511999998888."),
    email: z.string().optional(),
    instagram: z.string().optional().describe("Usuário do Instagram, sem @."),
    annotation: z.string().optional().describe("Notas internas da equipe sobre o contato."),
    tagIds: z.array(z.string()).optional().describe("IDs de etiquetas."),
    tagNames: z.array(z.string()).optional().describe("Nomes de etiquetas (ignorado se tagIds informado)."),
    portfolioIds: z.array(z.string()).optional(),
    portfolioNames: z.array(z.string()).optional(),
    sequenceIds: z.array(z.string()).optional().describe("IDs de sequências em que o contato deve entrar."),
    customFields: z
        .record(z.unknown())
        .optional()
        .describe("Chave -> valor dos campos personalizados (chaves em flw_list_custom_fields, entityType CONTACT)."),
    metadata: z.record(z.unknown()).optional().describe("Metadados livres do seu sistema."),
};
const includeDetails = z
    .array(z.enum(["Tags", "CustomFields", "Portfolios"]))
    .default(["Tags"])
    .describe("Detalhes extras a incluir na resposta.");
export const registerContactTools = ({ server, http }) => {
    server.registerTool("flw_search_contacts", {
        title: "Buscar contatos",
        description: "Busca paginada de contatos com filtros por texto, nome, telefone, e-mail, etiquetas, carteiras, " +
            "status, origem, campos personalizados e datas. Sem filtros, lista os contatos ativos. " +
            "Para um contato específico por ID ou telefone, prefira flw_get_contact.",
        inputSchema: {
            textFilter: z.string().optional().describe("Busca livre nos campos textuais do contato."),
            name: z.string().optional(),
            phoneNumber: z.string().optional(),
            email: z.string().optional(),
            instagram: z.string().optional(),
            tagIds: z.array(z.string()).optional(),
            tagNames: z.array(z.string()).optional(),
            portfolioIds: z.array(z.string()).optional(),
            portfolioNames: z.array(z.string()).optional(),
            status: z.enum(["ACTIVE", "ARCHIVED", "BLOCKED"]).optional().describe("Padrão: ACTIVE."),
            origin: z.enum(["CREATED_BY_USER", "CREATED_FROM_HUB", "IMPORTED"]).optional(),
            customFields: z.record(z.unknown()).optional().describe("Filtro por valores de campos personalizados."),
            metadata: z.record(z.unknown()).optional(),
            includeDetails,
            ...pagingShape,
            ...dateRangeShape,
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async (a) => {
        const body = compact({
            pageNumber: a.pageNumber,
            pageSize: a.pageSize,
            orderBy: a.orderBy,
            orderDirection: a.orderDirection,
            createdAt: a.createdAfter || a.createdBefore ? { after: a.createdAfter, before: a.createdBefore } : undefined,
            updatedAt: a.updatedAfter || a.updatedBefore ? { after: a.updatedAfter, before: a.updatedBefore } : undefined,
            includeDetails: a.includeDetails,
            status: a.status,
            textFilter: a.textFilter,
            name: a.name,
            phoneNumber: a.phoneNumber,
            email: a.email,
            instagram: a.instagram,
            tagIds: a.tagIds,
            tagNames: a.tagNames,
            portfolioIds: a.portfolioIds,
            portfolioNames: a.portfolioNames,
            origin: a.origin,
            customFields: a.customFields,
            metadata: a.metadata,
        });
        return ok((await http.post("/core/v1/contact/filter", body)).data);
    }));
    server.registerTool("flw_get_contact", {
        title: "Obter contato",
        description: "Obtém um contato pelo ID ou pelo número de telefone (um dos dois é obrigatório).",
        inputSchema: {
            contactId: z.string().optional().describe("ID do contato."),
            phoneNumber: z.string().optional().describe("Telefone com DDI, ex.: 5511999998888."),
            includeDetails: z.array(z.enum(["Tags", "CustomFields", "Portfolios"])).default(["Tags", "CustomFields", "Portfolios"]),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async ({ contactId, phoneNumber, includeDetails }) => {
        if (!contactId && !phoneNumber)
            throw new Error("Informe contactId ou phoneNumber.");
        const path = contactId
            ? `/core/v1/contact/${encodeURIComponent(contactId)}`
            : `/core/v1/contact/phonenumber/${encodeURIComponent(phoneNumber)}`;
        return ok((await http.get(path, { IncludeDetails: includeDetails })).data);
    }));
    server.registerTool("flw_create_contact", {
        title: "Criar contato",
        description: "Cria um contato. Com upsert=true, se já existir contato com o mesmo telefone/e-mail/Instagram ele é " +
            "atualizado em vez de duplicado; com getIfExists=true, o existente é retornado sem alteração.",
        inputSchema: {
            ...contactDataShape,
            upsert: z.boolean().default(false),
            upsertTagOperation: z.enum(["INSERTIFNOTEXISTS", "DELETEIFEXISTS", "REPLACEALL"]).optional(),
            getIfExists: z.boolean().default(false),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, guarded(async ({ upsert, upsertTagOperation, getIfExists, ...data }) => {
        const body = compact({
            ...compact(data),
            options: compact({ upsert, upsertTagOperation, getIfExists }),
        });
        return ok((await http.post("/core/v1/contact", body)).data);
    }));
    server.registerTool("flw_update_contact", {
        title: "Atualizar contato",
        description: "Atualiza somente os campos informados de um contato, localizado por ID ou telefone. " +
            "Para etiquetas, tagsOperation define se insere, remove ou substitui a lista.",
        inputSchema: {
            ...contactDataShape,
            contactId: z.string().optional(),
            phoneNumber: z.string().optional().describe("Telefone atual do contato (localizador), se não usar contactId."),
            newPhoneNumber: z.string().optional().describe("Novo telefone, quando o objetivo é alterar o número."),
            status: z.enum(["ACTIVE", "ARCHIVED", "BLOCKED"]).optional(),
            pictureUrl: z.string().url().optional(),
            tagsOperation: z.enum(["InsertIfNotExists", "DeleteIfExists", "ReplaceAll"]).default("InsertIfNotExists"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, guarded(async ({ contactId, phoneNumber, newPhoneNumber, tagsOperation, ...data }) => {
        if (!contactId && !phoneNumber)
            throw new Error("Informe contactId ou phoneNumber para localizar o contato.");
        const payload = compact({ ...data, phoneNumber: newPhoneNumber });
        const fields = deriveFields(payload, CONTACT_FIELD_MAP);
        if (fields.length === 0)
            throw new Error("Nenhum campo para atualizar foi informado.");
        const body = { fields, ...payload, options: { tagsOperation } };
        const path = contactId
            ? `/core/v2/contact/${encodeURIComponent(contactId)}`
            : `/core/v1/contact/phonenumber/${encodeURIComponent(phoneNumber)}`;
        return ok((await http.put(path, body)).data);
    }));
    server.registerTool("flw_update_contact_tags", {
        title: "Atualizar etiquetas de um contato",
        description: "Insere, remove ou substitui as etiquetas de um contato (por ID ou telefone) sem tocar nos demais campos.",
        inputSchema: {
            contactIdOrPhone: z.string().describe("ID do contato ou número de telefone."),
            tagNames: z.array(z.string()).optional(),
            tagIds: z.array(z.string()).optional(),
            operation: z.enum(["InsertIfNotExists", "DeleteIfExists", "ReplaceAll"]).default("InsertIfNotExists"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, guarded(async ({ contactIdOrPhone, tagNames, tagIds, operation }) => {
        if (!tagNames?.length && !tagIds?.length)
            throw new Error("Informe tagNames ou tagIds.");
        return ok((await http.post(`/core/v1/contact/${encodeURIComponent(contactIdOrPhone)}/tags`, compact({ tagNames, tagIds, operation }))).data);
    }));
    server.registerTool("flw_list_contacts", {
        title: "Listar contatos (simples)",
        description: "Listagem paginada simples por status e datas. Para filtros por nome, telefone, etiqueta etc. use flw_search_contacts.",
        inputSchema: {
            status: z.enum(["ACTIVE", "ARCHIVED", "BLOCKED"]).default("ACTIVE"),
            includeDetails,
            ...pagingShape,
            ...dateRangeShape,
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async (a) => ok((await http.get("/core/v1/contact", {
        Status: a.status,
        IncludeDetails: a.includeDetails,
        ...pagingQuery(a),
        ...dateQuery(a),
    })).data)));
};
