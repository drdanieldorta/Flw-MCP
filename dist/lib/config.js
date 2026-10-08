import { z } from "zod";
/**
 * Configuração lida exclusivamente de variáveis de ambiente.
 * O token nunca é logado integralmente: é mascarado em `describeConfig`.
 *
 * A API do FLW é a API pública da plataforma Helena/WTS Chat. A URL base
 * documentada é https://api.helena.run; os hosts api.flw.chat e api.wts.chat
 * expõem os mesmos módulos (/core, /chat, /crm).
 */
export const DEFAULT_BASE_URL = "https://api.helena.run";
const ConfigSchema = z.object({
    baseUrl: z
        .string()
        .url("FLW_BASE_URL precisa ser uma URL válida, ex.: https://api.helena.run")
        .default(DEFAULT_BASE_URL)
        .transform((u) => u.replace(/\/+$/, "")),
    apiKey: z
        .string()
        .min(1, "obrigatória, não definida. Gere em Ajustes > Integrações > Integração via API"),
    timeoutMs: z.coerce.number().int().positive().default(30_000),
    allowRawRequests: z
        .string()
        .optional()
        .transform((v) => (v ?? "false").toLowerCase() === "true"),
    enableMessaging: z
        .string()
        .optional()
        .transform((v) => (v ?? "false").toLowerCase() === "true"),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
/** Nome da variável de ambiente correspondente a cada campo, para mensagens úteis. */
const ENV_NAMES = {
    baseUrl: "FLW_BASE_URL",
    apiKey: "FLW_API_KEY",
    timeoutMs: "FLW_TIMEOUT_MS",
    allowRawRequests: "FLW_ALLOW_RAW_REQUESTS",
    enableMessaging: "FLW_ENABLE_MESSAGING",
    logLevel: "FLW_LOG_LEVEL",
};
export class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConfigError";
    }
}
export function loadConfig(env = process.env) {
    const parsed = ConfigSchema.safeParse({
        baseUrl: env.FLW_BASE_URL || undefined,
        apiKey: env.FLW_API_KEY || env.FLW_TOKEN || "",
        timeoutMs: env.FLW_TIMEOUT_MS || undefined,
        allowRawRequests: env.FLW_ALLOW_RAW_REQUESTS,
        enableMessaging: env.FLW_ENABLE_MESSAGING,
        logLevel: env.FLW_LOG_LEVEL || undefined,
    });
    if (!parsed.success) {
        const lines = parsed.error.issues.map((i) => {
            const field = String(i.path[0] ?? "");
            const name = ENV_NAMES[field] ?? field ?? "(raiz)";
            const msg = i.message === "Required" ? "obrigatória, não definida" : i.message;
            return `  - ${name}: ${msg}`;
        });
        throw new ConfigError([
            "Configuração inválida. Defina as variáveis de ambiente abaixo",
            "(veja .env.example ou README.md):",
            ...lines,
        ].join("\n"));
    }
    return parsed.data;
}
/** Versão segura para exibir ao usuário: nunca revela o token inteiro. */
export function describeConfig(cfg) {
    const k = cfg.apiKey;
    const masked = k.length <= 8 ? "*".repeat(k.length) : `${k.slice(0, 4)}…${k.slice(-4)}`;
    return {
        baseUrl: cfg.baseUrl,
        apiKey: masked,
        timeoutMs: cfg.timeoutMs,
        allowRawRequests: cfg.allowRawRequests,
        enableMessaging: cfg.enableMessaging,
    };
}
