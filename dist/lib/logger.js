const ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
let current = "info";
export function setLogLevel(level) {
    current = level;
}
function emit(level, msg, extra) {
    if (ORDER[level] < ORDER[current])
        return;
    const ts = new Date().toISOString();
    const tail = extra === undefined ? "" : ` ${safeJson(extra)}`;
    process.stderr.write(`[${ts}] [flw-mcp] ${level.toUpperCase()} ${msg}${tail}\n`);
}
function safeJson(v) {
    try {
        return JSON.stringify(v);
    }
    catch {
        return String(v);
    }
}
export const log = {
    debug: (m, e) => emit("debug", m, e),
    info: (m, e) => emit("info", m, e),
    warn: (m, e) => emit("warn", m, e),
    error: (m, e) => emit("error", m, e),
};
