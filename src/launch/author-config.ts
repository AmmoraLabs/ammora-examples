/** launch:author-config -- <templateId> <saleSupplyRaw> <quoteThresholdRaw> concentrated|compounding > full-config.json; read only. */
import { getAmmoraV4ConfigAtBlock, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { address, readBlock, reader, v4Deployment } from "../shared/env.js";
import { natural } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { authorLaunchConfig } from "./authoring.js";
main(async () => {
  const [id, supply, threshold, mode, ...extra] = process.argv.slice(2);
  if (extra.length || !["concentrated", "compounding"].includes(mode ?? "")) throw new Error("usage: <templateId> <saleSupplyRaw> <quoteThresholdRaw> concentrated|compounding");
  const client = await reader(), c = v4Deployment().contracts.launch, block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: c.configRegistry, launchFactory: c.factory, graduationAdapter: c.graduationAdapter, feePolicy: c.feePolicy }, block.number);
  const template = await getAmmoraV4ConfigAtBlock(client, c.configRegistry, natural(id, "templateId", true), block.number);
  if (!template.enabled) throw new Error("Template disabled");
  const { config, curve } = authorLaunchConfig(template, natural(supply, "saleSupplyRaw", true), natural(threshold, "quoteThresholdRaw", true), mode as "concentrated" | "compounding");
  printJson({ schemaVersion: 1, chainId: client.chain!.id, registry: c.configRegistry, configOwner: address("AMMORA_ACCOUNT"), config, segments: curve });
});
