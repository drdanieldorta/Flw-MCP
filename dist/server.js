import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./lib/config.js";
import { CrmHttpClient } from "./lib/http.js";
import { setLogLevel, log } from "./lib/logger.js";
import { registerAllTools } from "./tools/index.js";
export const SERVER_NAME = "flw-mcp";
export const SERVER_VERSION = "0.1.0";
/** Monta o servidor com todas as ferramentas registradas. Não conecta transporte. */
export function createServer(env = process.env) {
    const cfg = loadConfig(env);
    setLogLevel(cfg.logLevel);
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    const http = new CrmHttpClient(cfg);
    registerAllTools({ server, cfg, http });
    log.info("Servidor pronto", {
        baseUrl: cfg.baseUrl,
        rawRequests: cfg.allowRawRequests,
        messaging: cfg.enableMessaging,
    });
    return server;
}
