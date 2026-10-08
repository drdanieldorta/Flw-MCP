import { z } from "zod";
import { ok, guarded } from "../lib/result.js";
import { pagingShape, pagingQuery, dateRangeShape, dateQuery, compact, isoDateTime } from "../lib/schemas.js";
import type { ToolRegistrar } from "./types.js";

const sessionDetails = z
  .array(z.enum(["AgentDetails", "DepartmentsDetails", "ContactDetails", "ChannelTypeDetails", "ClassificationDetails", "ChannelDetails"]))
  .default(["ContactDetails", "AgentDetails", "DepartmentsDetails"]);

/** Atendimentos (conversas): leitura, histórico de mensagens e notas internas. */
export const registerSessionTools: ToolRegistrar = ({ server, http }) => {
  server.registerTool(
    "flw_list_sessions",
    {
      title: "Listar atendimentos",
      description:
        "Lista atendimentos (conversas) com filtros por status, equipe, atendente, contato, etiquetas, canal, " +
        "tipo e datas. Status: PENDING (novo/sem atendente), IN_PROGRESS, COMPLETED.",
      inputSchema: {
        status: z.array(z.enum(["STARTED", "PENDING", "IN_PROGRESS", "COMPLETED", "HIDDEN"])).optional(),
        departmentId: z.string().optional(),
        userId: z.string().optional(),
        contactId: z.string().optional(),
        tagsName: z.array(z.string()).optional(),
        channelsId: z.array(z.string()).optional(),
        type: z.enum(["INDIVIDUAL", "GROUP"]).optional(),
        lastInteractionAfter: isoDateTime.optional(),
        lastInteractionBefore: isoDateTime.optional(),
        endAfter: isoDateTime.optional().describe("Concluídos após esta data."),
        endBefore: isoDateTime.optional(),
        includeDetails: sessionDetails,
        ...pagingShape,
        ...dateRangeShape,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guarded(async (a) =>
      ok(
        (
          await http.get("/chat/v2/session", {
            Status: a.status,
            DepartmentId: a.departmentId,
            UserId: a.userId,
            ContactId: a.contactId,
            TagsName: a.tagsName,
            ChannelsId: a.channelsId,
            Type: a.type,
            "LastInteractionAt.After": a.lastInteractionAfter,
            "LastInteractionAt.Before": a.lastInteractionBefore,
            "EndAt.After": a.endAfter,
            "EndAt.Before": a.endBefore,
            IncludeDetails: a.includeDetails,
            ...pagingQuery(a),
            ...dateQuery(a),
          })
        ).data,
      ),
    ),
  );

  server.registerTool(
    "flw_get_session",
    {
      title: "Obter atendimento",
      description: "Obtém um atendimento pelo ID com contato, atendente, equipe, canal e classificação.",
      inputSchema: { sessionId: z.string(), includeDetails: sessionDetails },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guarded(async ({ sessionId, includeDetails }) =>
      ok((await http.get(`/chat/v2/session/${encodeURIComponent(sessionId)}`, { includeDetails })).data),
    ),
  );

  server.registerTool(
    "flw_list_session_messages",
    {
      title: "Listar mensagens de um atendimento",
      description:
        "Histórico paginado de mensagens de uma conversa (texto, mídia, direção FROM_HUB = enviada pela empresa, " +
        "TO_HUB = recebida do contato). Útil para resumir ou analisar um atendimento.",
      inputSchema: { sessionId: z.string(), ...pagingShape, ...dateRangeShape },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guarded(async (a) =>
      ok(
        (
          await http.get(`/chat/v1/session/${encodeURIComponent(a.sessionId)}/message`, {
            ...pagingQuery(a),
            ...dateQuery(a),
          })
        ).data,
      ),
    ),
  );

  server.registerTool(
    "flw_list_session_notes",
    {
      title: "Listar notas internas de um atendimento",
      description: "Lista as notas internas (não visíveis ao contato) de uma conversa.",
      inputSchema: { sessionId: z.string(), ...pagingShape },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guarded(async (a) =>
      ok((await http.get(`/chat/v1/session/${encodeURIComponent(a.sessionId)}/note`, pagingQuery(a))).data),
    ),
  );

  server.registerTool(
    "flw_add_session_note",
    {
      title: "Adicionar nota interna a um atendimento",
      description: "Registra uma nota interna na conversa. O contato NÃO recebe esta mensagem.",
      inputSchema: {
        sessionId: z.string(),
        text: z.string().min(1),
        filesUrls: z.array(z.string().url()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    guarded(async ({ sessionId, text, filesUrls }) =>
      ok((await http.post(`/chat/v1/session/${encodeURIComponent(sessionId)}/note`, compact({ text, filesUrls }))).data),
    ),
  );

  server.registerTool(
    "flw_list_templates",
    {
      title: "Listar modelos de mensagem",
      description: "Lista os modelos de mensagem (templates) aprovados, necessários para iniciar conversa no WhatsApp oficial.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guarded(async () => ok((await http.get("/chat/v1/template")).data)),
  );
};
