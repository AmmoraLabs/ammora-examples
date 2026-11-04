/** The module controller requests admission directly; no platform signature is requested. */
import { fromProfileFile, cli, required, hash, address, stage } from "./context.js";
export const prepareSelfServiceRegistration = (client: ReturnType<typeof fromProfileFile>["admission"], id: `0x${string}`, module: `0x${string}`, selectedStage: 0 | 1, controller: `0x${string}`) => client.planRegistration(id, module, selectedStage, controller);
cli(import.meta.url, async () => { const c = fromProfileFile(required(2, "profile.json")); return { plan: await prepareSelfServiceRegistration(c.admission, hash(required(3, "templateId")), address(required(4, "module")), stage(required(5, "stage0or1")), address(required(6, "controller"))), stats: c.stats(), automaticSend: false }; });
