import { registerSystemTools } from "./system.js";
import { registerLookupTools } from "./lookups.js";
import { registerContactTools } from "./contacts.js";
import { registerCrmTools } from "./crm.js";
import { registerSequenceTools } from "./sequences.js";
import { registerSessionTools } from "./sessions.js";
import { registerMessagingTools } from "./messaging.js";
import type { ToolContext } from "./types.js";

/**
 * Ponto único de registro. Para adicionar um domínio, crie src/tools/<dominio>.ts
 * exportando um ToolRegistrar e acrescente-o na lista abaixo.
 */
export function registerAllTools(ctx: ToolContext): void {
  const registrars = [
    registerSystemTools,
    registerLookupTools,
    registerContactTools,
    registerCrmTools,
    registerSequenceTools,
    registerSessionTools,
    registerMessagingTools,
  ];
  for (const register of registrars) register(ctx);
}
