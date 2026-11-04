/** Check an existing standard before spending gas; compatible is not consent or approval. */
import type { ExtensionConfigV2 } from "@ammora-protocol/sdk/partner";
import { readFileSync } from "node:fs";
import { fromProfileFile, cli, required, hash, stage } from "./context.js";
export const diagnoseSelfServiceConfiguration = (client: ReturnType<typeof fromProfileFile>["admission"], id: `0x${string}`, configuration: ExtensionConfigV2, selectedStage: 0 | 1) => client.diagnoseConfiguration(id, configuration, selectedStage);
cli(import.meta.url, async () => { const c = fromProfileFile(required(2, "profile.json")); return { ...await diagnoseSelfServiceConfiguration(c.admission, hash(required(3, "templateId")), JSON.parse(readFileSync(required(4, "configuration.json"), "utf8")) as ExtensionConfigV2, stage(required(5, "stage0or1"))), stats: c.stats(), executionApproved: false }; });
