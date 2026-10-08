import { z } from "zod";
/** Data/hora ISO 8601. A API interpreta sempre em UTC. */
export const isoDateTime = z
    .string()
    .describe("Data/hora ISO 8601 em UTC, ex.: 2026-10-01T00:00:00Z");
export const uuid = z.string().uuid();
/** Parâmetros de paginação comuns aos endpoints de listagem (GET). */
export const pagingShape = {
    pageNumber: z.number().int().min(1).default(1).describe("Página a obter (começa em 1)."),
    pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Itens por página (máximo 100). Mantenha constante ao percorrer páginas."),
    orderBy: z.string().optional().describe("Campo usado para ordenar, ex.: 'createdAt'."),
    orderDirection: z.enum(["ASCENDING", "DESCENDING"]).optional(),
};
/** Filtros de data comuns aos endpoints de listagem. */
export const dateRangeShape = {
    createdAfter: isoDateTime.optional().describe("Somente itens criados após esta data."),
    createdBefore: isoDateTime.optional().describe("Somente itens criados antes desta data."),
    updatedAfter: isoDateTime.optional().describe("Somente itens atualizados após esta data."),
    updatedBefore: isoDateTime.optional().describe("Somente itens atualizados antes desta data."),
};
/** Converte os parâmetros de paginação para o formato de query da API. */
export function pagingQuery(a) {
    return {
        PageNumber: a.pageNumber,
        PageSize: a.pageSize,
        OrderBy: a.orderBy,
        OrderDirection: a.orderDirection,
    };
}
/** Converte os filtros de data para o formato de query da API. */
export function dateQuery(a) {
    return {
        "CreatedAt.After": a.createdAfter,
        "CreatedAt.Before": a.createdBefore,
        "UpdatedAt.After": a.updatedAfter,
        "UpdatedAt.Before": a.updatedBefore,
    };
}
/** Remove chaves undefined de um objeto (para corpos de requisição limpos). */
export function compact(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj))
        if (v !== undefined)
            out[k] = v;
    return out;
}
/**
 * Deriva o array `fields` exigido pelos endpoints de atualização (PUT) a partir
 * das chaves efetivamente informadas, usando o mapa chave -> nome do campo.
 */
export function deriveFields(input, map) {
    const set = new Set();
    for (const [k, v] of Object.entries(input)) {
        if (v !== undefined && map[k])
            set.add(map[k]);
    }
    return [...set];
}
