/** launch:fee-config -- preview|document <fees.json> <saleSupplyRaw> <quoteThresholdRaw>
 * Both modes only read. Pass the generated document to launch:config-json to create.
 */
import { readFile } from "node:fs/promises";
import { getAmmoraV4ConfigAtBlock, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { readBlock, reader, v4Deployment } from "../../shared/env.js";
import { printJson, rawAmount } from "../../shared/input.js";
import { main } from "../../shared/run.js";
import { parseTeamFeePolicy, planTeamFeeConfig } from "./fee-policy.js";

main(async () => {
  const [mode, path, supplyArg, thresholdArg, ...extra] = process.argv.slice(2);
  if (!path || !["preview", "document"].includes(mode ?? "") || extra.length) throw new Error("usage: preview|document <fees.json> <saleSupplyRaw> <quoteThresholdRaw>");
  const policy = parseTeamFeePolicy(JSON.parse(await readFile(path, "utf8")));
  const supply = rawAmount(supplyArg, "saleSupplyRaw"), threshold = rawAmount(thresholdArg, "quoteThresholdRaw");
  const client = await reader(), launch = v4Deployment().contracts.launch;
  if (client.chain?.id !== policy.chainId || launch.configRegistry.toLowerCase() !== policy.registry.toLowerCase()) throw new Error("fee policy chain/registry does not match selected deployment");
  const block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy }, block.number);
  const template = await getAmmoraV4ConfigAtBlock(client, launch.configRegistry, BigInt(policy.templateId), block.number);
  const result = planTeamFeeConfig(template, policy, { chainId: policy.chainId, registry: launch.configRegistry }, supply, threshold);
  // -s npm suppresses its command banner so stdout can be redirected to valid JSON.
  printJson(mode === "document" ? result.document : {
    blockNumber: block.number, blockHash: block.hash, policy, ...result,
    next: "Save document, run launch:config-json preview with AMMORA_ACCOUNT=configOwner, then explicitly create with its reviewHash.",
  });
});
