import { log } from "./logger.js";
export class HttpError extends Error {
    status;
    method;
    url;
    body;
    constructor(status, method, url, body) {
        super(`HTTP ${status} em ${method} ${url}`);
        this.status = status;
        this.method = method;
        this.url = url;
        this.body = body;
        this.name = "HttpError";
    }
}
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
/**
 * Cliente HTTP único para a API: injeta o token Bearer, aplica timeout,
 * refaz tentativas com backoff (respeitando Retry-After em 429) e normaliza
 * erros. Todas as ferramentas devem passar por aqui, nunca chamar `fetch`.
 */
export class CrmHttpClient {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    buildUrl(path, query) {
        const url = path.startsWith("http")
            ? new URL(path)
            : new URL(`${this.cfg.baseUrl}/${path.replace(/^\/+/, "")}`);
        if (!url.href.startsWith(this.cfg.baseUrl)) {
            throw new Error(`Caminho fora da base configurada (${this.cfg.baseUrl}): ${path}`);
        }
        for (const [k, v] of Object.entries(query ?? {})) {
            if (v === undefined || v === null)
                continue;
            if (Array.isArray(v)) {
                for (const item of v)
                    url.searchParams.append(k, String(item));
            }
            else {
                url.searchParams.set(k, String(v));
            }
        }
        return url;
    }
    async request(opts) {
        const method = opts.method ?? "GET";
        const url = this.buildUrl(opts.path, opts.query);
        const retries = opts.retries ?? 2;
        const headers = {
            Accept: "application/json",
            "User-Agent": "flw-mcp/0.1.0",
            Authorization: `Bearer ${this.cfg.apiKey}`,
            ...(opts.headers ?? {}),
        };
        let body;
        if (opts.body !== undefined && method !== "GET") {
            headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
            body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
        }
        let attempt = 0;
        let lastErr;
        while (attempt <= retries) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
            try {
                log.debug(`→ ${method} ${url.href}`, { attempt });
                const res = await fetch(url, { method, headers, body, signal: controller.signal });
                const data = await parseBody(res);
                const resHeaders = {};
                res.headers.forEach((v, k) => (resHeaders[k] = v));
                log.debug(`← ${res.status} ${method} ${url.href}`);
                if (!res.ok) {
                    if (RETRYABLE.has(res.status) && attempt < retries) {
                        await backoff(attempt, res.headers.get("retry-after"));
                        attempt++;
                        continue;
                    }
                    throw new HttpError(res.status, method, url.href, data);
                }
                return { status: res.status, ok: true, headers: resHeaders, data: data };
            }
            catch (err) {
                lastErr = err;
                if (err instanceof HttpError)
                    throw err;
                if (attempt < retries) {
                    log.warn(`Falha de rede em ${method} ${url.href}, tentando de novo`, {
                        attempt,
                        error: String(err),
                    });
                    await backoff(attempt, null);
                    attempt++;
                    continue;
                }
                throw err;
            }
            finally {
                clearTimeout(timer);
            }
        }
        throw lastErr;
    }
    get(path, query) {
        return this.request({ method: "GET", path, query });
    }
    post(path, body, query) {
        return this.request({ method: "POST", path, body, query });
    }
    put(path, body, query) {
        return this.request({ method: "PUT", path, body, query });
    }
    delete(path, body, query) {
        return this.request({ method: "DELETE", path, body, query });
    }
}
async function parseBody(res) {
    const text = await res.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
async function backoff(attempt, retryAfter) {
    let ms = Math.min(500 * 2 ** attempt, 8_000) + Math.random() * 250;
    if (retryAfter) {
        const secs = Number(retryAfter);
        if (Number.isFinite(secs) && secs > 0)
            ms = Math.min(secs * 1000, 30_000);
    }
    await new Promise((r) => setTimeout(r, ms));
}
