/**
 * Logger mínimo que escreve SOMENTE em stderr.
 * Em transporte stdio, o stdout pertence ao protocolo MCP: qualquer byte
 * extra ali corrompe a comunicação com o cliente (Claude Desktop, Cursor...).
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let current: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  current = level;
}

function emit(level: LogLevel, msg: string, extra?: unknown): void {
  if (ORDER[level] < ORDER[current]) return;
  const ts = new Date().toISOString();
  const tail = extra === undefined ? "" : ` ${safeJson(extra)}`;
  process.stderr.write(`[${ts}] [mdia-flw-mcp] ${level.toUpperCase()} ${msg}${tail}\n`);
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const log = {
  debug: (m: string, e?: unknown) => emit("debug", m, e),
  info: (m: string, e?: unknown) => emit("info", m, e),
  warn: (m: string, e?: unknown) => emit("warn", m, e),
  error: (m: string, e?: unknown) => emit("error", m, e),
};
