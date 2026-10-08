import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../lib/config.js";
import type { CrmHttpClient } from "../lib/http.js";

/** Tudo que uma ferramenta precisa para funcionar. */
export interface ToolContext {
  server: McpServer;
  cfg: Config;
  http: CrmHttpClient;
}

/** Cada módulo em src/tools exporta uma função com esta assinatura. */
export type ToolRegistrar = (ctx: ToolContext) => void;
