/** A current rights holder/controller cancels through their own wallet; accrued claims remain. */
import { fromProfileFile, cli, required, address, stage } from "./context.js";
export const prepareSelfServiceCancellation = (client: ReturnType<typeof fromProfileFile>["admission"], module: `0x${string}`, selectedStage: 0 | 1, rightsHolder: `0x${string}`) => client.planCancellation(module, selectedStage, rightsHolder);
cli(import.meta.url, async () => { const c = fromProfileFile(required(2, "profile.json")); return { plan: await prepareSelfServiceCancellation(c.admission, address(required(3, "module")), stage(required(4, "stage0or1")), address(required(5, "rightsHolder"))), stats: c.stats(), automaticSend: false }; });
