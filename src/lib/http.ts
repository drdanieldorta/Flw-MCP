import type { Config } from "./config.js";
import { log } from "./logger.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue = string | number | boolean | string[] | undefined | null;
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  method?: HttpMethod;
  /** Caminho relativo à base, incluindo o módulo. Ex.: "/crm/v2/panel". */
  path: string;
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  /** Tentativas extras em 429/5xx/erro de rede. Padrão 2. */
  retries?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  data: T;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly method: string,
    public readonly url: string,
    public readonly body: unknown,
  ) {
    super(`HTTP ${status} em ${method} ${url}`);
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
  constructor(private readonly cfg: Config) {}

  buildUrl(path: string, query?: Query): URL {
    const url = path.startsWith("http")
      ? new URL(path)
      : new URL(`${this.cfg.baseUrl}/${path.replace(/^\/+/, "")}`);

    if (!url.href.startsWith(this.cfg.baseUrl)) {
      throw new Error(`Caminho fora da base configurada (${this.cfg.baseUrl}): ${path}`);
    }
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    return url;
  }

  async request<T = unknown>(opts: RequestOptions): Promise<HttpResponse<T>> {
    const method = opts.method ?? "GET";
    const url = this.buildUrl(opts.path, opts.query);
    const retries = opts.retries ?? 2;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "mdia-flw-mcp/0.1.0",
      Authorization: `Bearer ${this.cfg.apiKey}`,
      ...(opts.headers ?? {}),
    };
    let body: string | undefined;
    if (opts.body !== undefined && method !== "GET") {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    }

    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
      try {
        log.debug(`→ ${method} ${url.href}`, { attempt });
        const res = await fetch(url, { method, headers, body, signal: controller.signal });
        const data = await parseBody(res);
        const resHeaders: Record<string, string> = {};
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
        return { status: res.status, ok: true, headers: resHeaders, data: data as T };
      } catch (err) {
        lastErr = err;
        if (err instanceof HttpError) throw err;
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
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  get<T = unknown>(path: string, query?: Query) {
    return this.request<T>({ method: "GET", path, query });
  }
  post<T = unknown>(path: string, body?: unknown, query?: Query) {
    return this.request<T>({ method: "POST", path, body, query });
  }
  put<T = unknown>(path: string, body?: unknown, query?: Query) {
    return this.request<T>({ method: "PUT", path, body, query });
  }
  delete<T = unknown>(path: string, body?: unknown, query?: Query) {
    return this.request<T>({ method: "DELETE", path, body, query });
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function backoff(attempt: number, retryAfter: string | null): Promise<void> {
  let ms = Math.min(500 * 2 ** attempt, 8_000) + Math.random() * 250;
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs > 0) ms = Math.min(secs * 1000, 30_000);
  }
  await new Promise((r) => setTimeout(r, ms));
}
