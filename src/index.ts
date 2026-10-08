#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import { ConfigError } from "./lib/config.js";
import { log } from "./lib/logger.js";

const args = process.argv.slice(2);
if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${SERVER_NAME} ${SERVER_VERSION}\n`);
  process.exit(0);
}
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(
    [
      `${SERVER_NAME} ${SERVER_VERSION}: servidor MCP (stdio) para o CRM da plataforma FLW.`,
      "",
      "Uso: é iniciado pelo cliente MCP (Claude Code, Codex, Claude Desktop, Cursor), não manualmente.",
      "Configuração por variáveis de ambiente: FLW_API_KEY (obrigatória), FLW_BASE_URL, FLW_ENABLE_MESSAGING,",
      "FLW_ALLOW_RAW_REQUESTS, FLW_TIMEOUT_MS, FLW_LOG_LEVEL.",
      "Documentação: https://github.com/drdanieldorta/Flw-MCP#readme",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("Conectado via stdio");
}

main().catch((err) => {
  if (err instanceof ConfigError) {
    process.stderr.write(`\n${err.message}\n\n`);
    process.exit(2);
  }
  log.error("Falha fatal", { error: String(err?.stack ?? err) });
  process.exit(1);
});
