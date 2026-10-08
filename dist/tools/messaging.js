import { z } from "zod";
import { ok, guarded } from "../lib/result.js";
import { compact } from "../lib/schemas.js";
/**
 * Envio de mensagens ao contato. Ação de alto impacto (chega no WhatsApp do
 * cliente), por isso só é registrada quando FLW_ENABLE_MESSAGING=true.
 */
export const registerMessagingTools = ({ server, cfg, http }) => {
    if (!cfg.enableMessaging)
        return;
    server.registerTool("flw_send_text", {
        title: "Enviar mensagem de texto",
        description: "Envia um texto simples ao contato pelo canal informado. ATENÇÃO: no WhatsApp oficial, uma conversa " +
            "fora da janela de 24h só pode ser iniciada com modelo (use flw_send_template). " +
            "Se não houver atendimento aberto, um novo é criado (opcionalmente para uma equipe/usuário).",
        inputSchema: {
            to: z.string().describe("Telefone do destinatário com DDI, ex.: 5511999998888."),
            from: z.string().optional().describe("Número/ID do canal remetente (flw_list_channels). Opcional se houver um só."),
            text: z.string().min(1),
            sessionId: z.string().optional().describe("ID do atendimento, para responder dentro de uma conversa específica."),
            departmentId: z.string().optional().describe("Equipe do novo atendimento, se criado."),
            userId: z.string().optional().describe("Atendente do novo atendimento, se criado."),
            delayTypingSeconds: z.number().int().min(0).max(25).optional().describe("Simula 'digitando...' antes de enviar."),
            enableBot: z.boolean().optional(),
            hiddenSession: z.boolean().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    }, guarded(async (a) => {
        const body = compact({
            to: a.to,
            from: a.from,
            text: a.text,
            sessionId: a.sessionId,
            delayTyping: a.delayTypingSeconds,
            options: compact({
                enableBot: a.enableBot,
                hiddenSession: a.hiddenSession,
                department: a.departmentId ? { id: a.departmentId } : undefined,
                user: a.userId ? { id: a.userId } : undefined,
            }),
        });
        return ok((await http.post("/chat/v1/send/text", body)).data);
    }));
    server.registerTool("flw_send_template", {
        title: "Enviar modelo de mensagem (template)",
        description: "Envia um modelo de mensagem aprovado (com parâmetros) ou um arquivo ao contato. É a forma correta de " +
            "iniciar conversa no WhatsApp oficial. Obtenha o templateId em flw_list_templates. " +
            "Se o contato não existir, é criado automaticamente.",
        inputSchema: {
            to: z.string().describe("Telefone do destinatário com DDI."),
            from: z.string().optional().describe("Número do canal remetente."),
            templateId: z.string().optional(),
            parameters: z.record(z.string()).optional().describe("Parâmetros do modelo, chave -> valor."),
            text: z.string().optional().describe("Texto, quando não usar templateId."),
            fileUrl: z.string().url().optional().describe("URL pública de arquivo a enviar."),
            botKey: z.string().optional().describe("Chave do chatbot a ativar após a resposta."),
            departmentId: z.string().optional(),
            userId: z.string().optional(),
            forceStartSession: z.boolean().optional().describe("Encerra atendimento em andamento e inicia outro."),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    }, guarded(async (a) => {
        if (!a.templateId && !a.text && !a.fileUrl)
            throw new Error("Informe templateId, text ou fileUrl.");
        const body = compact({
            from: a.from,
            to: a.to,
            botKey: a.botKey,
            body: compact({ templateId: a.templateId, parameters: a.parameters, text: a.text, fileUrl: a.fileUrl }),
            department: a.departmentId ? { id: a.departmentId } : undefined,
            user: a.userId ? { id: a.userId } : undefined,
            options: compact({ forceStartSession: a.forceStartSession }),
        });
        return ok((await http.post("/chat/v1/message/send", body)).data);
    }));
};
