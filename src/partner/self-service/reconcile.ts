/** Restore only a receipt-check envelope from exportRecovery; it cannot become a send plan. */
import { readFileSync } from "node:fs";
import { fromProfileFile, cli, required } from "./context.js";
export const reconcileSelfServiceRecovery = (client: ReturnType<typeof fromProfileFile>["admission"], recovery: string) => client.reconcileRecovery(recovery, "observed");
cli(import.meta.url, async () => { const c = fromProfileFile(required(2, "profile.json")); return { ...await reconcileSelfServiceRecovery(c.admission, readFileSync(required(3, "recovery-envelope.json"), "utf8")), stats: c.stats(), mayResubmit: false }; });
