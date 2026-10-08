import { z } from "zod";
import { describeConfig } from "../lib/config.js";
import { ok, fail, guarded } from "../lib/result.js";
/**
 * Ferramentas de diagnóstico. Servem para o usuário (ou o modelo) confirmar
 * que a instalação funciona e, em desenvolvimento, explorar a API.
 */
export const registerSystemTools = ({ server, cfg, http }) => {
    server.registerTool("flw_status", {
        title: "Status da conexão com o FLW",
        description: "Mostra a configuração ativa (token mascarado) e testa a autenticação listando os " +
            "canais de atendimento da conta. Use primeiro quando algo não funcionar.",
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, guarded(async () => {
        const config = describeConfig(cfg);
        const started = Date.now();
        try {
            const res = await http.request({
                method: "GET",
                path: "/chat/v1/channel",
                retries: 0,
            });
            const channels = Array.isArray(res.data) ? res.data.length : undefined;
            return ok({ config, probe: { ok: true, status: res.status, channels, ms: Date.now() - started } });
        }
        catch (err) {
            const probe = fail(err);
            const text = probe.content[0] && "text" in probe.content[0] ? probe.content[0].text : String(err);
            return ok({ config, probe: { ok: false, ms: Date.now() - started, error: text } }, "Configuração carregada, mas a chamada de teste falhou. Verifique FLW_API_KEY (token permanente " +
                "gerado em Ajustes > Integrações > Integração via API) e FLW_BASE_URL:");
        }
    }));
    if (cfg.allowRawRequests) {
        server.registerTool("flw_request", {
            title: "Requisição HTTP genérica à API do FLW",
            description: "Executa uma chamada HTTP arbitrária à API pública (módulos /core, /chat, /crm), já autenticada. " +
                "Ferramenta de exploração, habilitada por FLW_ALLOW_RAW_REQUESTS=true. " +
                "Prefira sempre as ferramentas específicas quando existirem. Referência: https://helena.readme.io/reference",
            inputSchema: {
                method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
                path: z.string().describe("Caminho com módulo e versão, ex.: '/crm/v2/panel'"),
                query: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
                body: z.unknown().optional().describe("Corpo JSON para POST/PUT/PATCH/DELETE"),
            },
            annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
        }, guarded(async ({ method, path, query, body }) => {
            const res = await http.request({ method, path, query, body });
            return ok({ status: res.status, data: res.data });
        }));
    }
};
