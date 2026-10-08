import { z } from "zod";
import { ok, guarded } from "../lib/result.js";
import { pagingShape, pagingQuery, dateRangeShape, dateQuery, compact } from "../lib/schemas.js";
import type { ToolRegistrar } from "./types.js";

/** Sequências: fluxos automáticos de nutrição/follow-up por etapas. */
export const registerSequenceTools: ToolRegistrar = ({ server, http }) => {
  server.registerTool(
    "flw_list_sequences",
    {
      title: "Listar sequências",
      description: "Lista as sequências (fluxos de nutrição) da conta, com estatísticas de execução.",
      inputSchema: {
        name: z.string().optional().describe("Filtro por nome."),
        contactId: z.string().optional().describe("Somente sequências em que este contato está."),
        ...pagingShape,
        ...dateRangeShape,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guarded(async (a) =>
      ok(
        (
          await http.get("/chat/v1/sequence", {
            Name: a.name,
            ContactId: a.contactId,
            IncludeDetails: ["ContactExecutingCount", "ExecutionStats"],
            ...pagingQuery(a),
            ...dateQuery(a),
          })
        ).data,
      ),
    ),
  );

  server.registerTool(
    "flw_list_sequence_contacts",
    {
      title: "Listar contatos em uma sequência",
      description: "Lista os contatos atualmente em execução em uma sequência.",
      inputSchema: {
        sequenceId: z.string(),
        name: z.string().optional(),
        phoneNumber: z.string().optional(),
        ...pagingShape,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guarded(async (a) =>
      ok(
        (
          await http.get(`/chat/v2/sequence/${encodeURIComponent(a.sequenceId)}/contact`, {
            Name: a.name,
            PhoneNumber: a.phoneNumber,
            IncludeDetails: ["ContactDetails"],
            ...pagingQuery(a),
          })
        ).data,
      ),
    ),
  );

  server.registerTool(
    "flw_sequence_contacts",
    {
      title: "Adicionar ou remover contatos de uma sequência",
      description:
        "Adiciona (add) ou remove (remove) um ou mais contatos de uma sequência, por IDs ou telefones. " +
        "Adicionar dispara o fluxo de mensagens automáticas da sequência para esses contatos.",
      inputSchema: {
        action: z.enum(["add", "remove"]),
        sequenceId: z.string(),
        contactIds: z.array(z.string()).optional(),
        phoneNumbers: z.array(z.string()).optional().describe("Telefones; contatos inexistentes são criados."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    guarded(async ({ action, sequenceId, contactIds, phoneNumbers }) => {
      if (!contactIds?.length && !phoneNumbers?.length) throw new Error("Informe contactIds ou phoneNumbers.");
      const path = `/chat/v1/sequence/${encodeURIComponent(sequenceId)}/contact/batch`;
      const body = compact({ contactIds, phoneNumbers });
      const res = action === "add" ? await http.post(path, body) : await http.delete(path, body);
      return ok(res.data ?? { ok: true, action, sequenceId });
    }),
  );
};
