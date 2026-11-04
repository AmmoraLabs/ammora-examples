/** Prepare deterministic module/vault creation and each actual holder's consent; never sends. */
import type { ExtensionConfigV2 } from "@ammora-protocol/sdk/partner";
import { readFileSync } from "node:fs";
import { fromProfileFile, cli, required } from "./context.js";
export const prepareSelfServiceDeployment = (client: ReturnType<typeof fromProfileFile>["extension"], configuration: ExtensionConfigV2) => client.planDeployment(configuration);
cli(import.meta.url, async () => { const c = fromProfileFile(required(2, "profile.json")); return { ...await prepareSelfServiceDeployment(c.extension, JSON.parse(readFileSync(required(3, "configuration.json"), "utf8")) as ExtensionConfigV2), stats: c.stats(), automaticSend: false }; });
