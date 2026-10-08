#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { ConfigError } from "./lib/config.js";
import { log } from "./lib/logger.js";

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
