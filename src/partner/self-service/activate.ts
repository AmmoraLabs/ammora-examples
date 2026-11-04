/** Return waiting/existing/action from actual chain time; never poll, fast-forward or auto-send. */
import { fromProfileFile, cli, required, hash, address, stage } from "./context.js";
export const prepareSelfServiceActivation = (client: ReturnType<typeof fromProfileFile>["admission"], id: `0x${string}`, module: `0x${string}`, selectedStage: 0 | 1, caller: `0x${string}`) => client.planActivation(id, module, selectedStage, caller);
cli(import.meta.url, async () => { const c = fromProfileFile(required(2, "profile.json")); return { ...await prepareSelfServiceActivation(c.admission, hash(required(3, "templateId")), address(required(4, "module")), stage(required(5, "stage0or1")), address(required(6, "caller"))), stats: c.stats(), automaticSend: false }; });
