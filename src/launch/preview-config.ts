/** npm run launch:preview-config -- <templateId> <saleSupplyRaw> <quoteThresholdRaw> <configOwner> */
import { buildCreateAmmoraV4Config, getAmmoraV4ConfigAtBlock, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { address, readBlock, reader, v4Deployment } from "../shared/env.js";
import { printJson, rawAmount } from "../shared/input.js";
import { main } from "../shared/run.js";
import { deriveConfigFromTemplate } from "./config-from-template.js";

main(async () => {
  const [templateArg, supplyArg, thresholdArg, ownerArg, ...extra] = process.argv.slice(2);
  if (!ownerArg || extra.length) throw new Error("usage: <templateId> <saleSupplyRaw> <quoteThresholdRaw> <configOwner>");
  const templateId = rawAmount(templateArg, "templateId");
  const saleSupply = rawAmount(supplyArg, "saleSupplyRaw");
  const threshold = rawAmount(thresholdArg, "quoteThresholdRaw");
  const owner = address("AMMORA_CONFIG_OWNER", ownerArg);
  const client = await reader();
  const launch = v4Deployment().contracts.launch;
  const block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy }, block.number);
  const template = await getAmmoraV4ConfigAtBlock(client, launch.configRegistry, templateId, block.number);
  if (!template.enabled) throw new Error(`template Config #${templateId} is disabled`);
  const { config, curve, economics } = deriveConfigFromTemplate(template, saleSupply, threshold);
  const transaction = { to: launch.configRegistry, ...buildCreateAmmoraV4Config(config, curve, owner) };
  printJson({ blockNumber: block.number, blockHash: block.hash, snapshot: block.snapshot, templateId, templateHash: template.configHash, owner, config, curve, economics, transaction,
    note: "Validated calldata preview; not simulated or sent. Template recipients, fees, vesting and LP policy are inherited. Review the complete Config before authoring your own launchpad policy.",
  });
});
