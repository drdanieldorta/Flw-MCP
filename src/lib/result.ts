import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { HttpError } from "./http.js";

/** Resposta de sucesso: JSON legível no bloco de texto. */
export function ok(data: unknown, note?: string): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text: note ? `${note}\n\n${text}` : text }],
  };
}

/**
 * Resposta de erro: `isError: true` faz o modelo perceber a falha e
 * reagir (corrigir parâmetros, avisar o usuário), em vez de tratar o texto
 * como resultado válido.
 */
export function fail(err: unknown): CallToolResult {
  let text: string;
  if (err instanceof HttpError) {
    const body =
      typeof err.body === "string" ? err.body : JSON.stringify(err.body, null, 2);
    text = `${err.message}\n\nResposta do CRM:\n${body ?? "(vazia)"}`;
  } else if (err instanceof Error) {
    text = err.name === "AbortError" ? "Tempo limite excedido ao chamar o CRM." : err.message;
  } else {
    text = String(err);
  }
  return { isError: true, content: [{ type: "text", text }] };
}

/** Envolve um handler para que exceções virem `fail()` em vez de derrubar o servidor. */
export function guarded<A extends unknown[]>(
  fn: (...args: A) => Promise<CallToolResult>,
): (...args: A) => Promise<CallToolResult> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return fail(err);
    }
  };
}
