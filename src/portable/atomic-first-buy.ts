/** portable:atomic-first-buy -- <deployment> <targets> <templateId> <saleRaw> <thresholdRaw> <name> <symbol> <uri> <quoteRaw> <minimumBaseRaw> <maxFeeWei> [deadlineUnix]. */
import { readFile } from "node:fs/promises";
import { AmmoraPortableLifecyclePlanner, verifyAmmoraPortableDeploymentAtBlock, assertAmmoraPortableBlockCanonical, getAmmoraV4ConfigAtBlock, type AmmoraPortableDeployment, type AmmoraPortableLifecycleTargets } from "@ammora-protocol/sdk";
import { caller, deadline, execute, natural } from "../shared/actions.js";
import { reader, readBlock } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { requireHelper } from "../arl/optional-guards.js";
import { deriveConfigFromTemplate } from "../launch/config-from-template.js";
import { main } from "../shared/run.js";

main(async () => {
  const [deploymentFile, targetsFile, templateId, sale, threshold, name, symbol, uri, quote, minimum, maxFee, expiry] = process.argv.slice(2);
  if (!deploymentFile || !targetsFile || !name || !symbol || !uri) throw new Error("Supply reviewed manifests, template/economics, launch metadata, first-buy amounts and gas limit");
  const deployment = JSON.parse(await readFile(deploymentFile, "utf8")) as AmmoraPortableDeployment;
  const targets = JSON.parse(await readFile(targetsFile, "utf8")) as AmmoraPortableLifecycleTargets;
  requireHelper(targets.firstBuyExecutor, "firstBuyExecutor");
  const client = await reader(), block = await readBlock(client), account = caller();
  const context = await verifyAmmoraPortableDeploymentAtBlock(client, deployment, block.number);
  const template = await getAmmoraV4ConfigAtBlock(client, deployment.contracts.configRegistry, natural(templateId, "templateId", true), block.number);
  if (!template.enabled) throw new Error("Template is disabled");
  const { config, curve } = deriveConfigFromTemplate(template, natural(sale, "saleRaw", true), natural(threshold, "thresholdRaw", true));
  const plan = await new AmmoraPortableLifecyclePlanner(context, targets).planAtomicFirstBuy({
    account, config, segments: curve,
    launch: { name, symbol, metadataURI: uri, creatorMetadataURI: uri, tokenDecimals: config.tokenDecimals },
    firstBuys: [{ includedQuoteAmountRaw: natural(quote, "quoteRaw", true), minimumBaseAmountOutRaw: natural(minimum, "minimumBaseRaw", true), allowPartialFill: false, recipient: account }],
    deadline: expiry ? natural(expiry, "deadlineUnix", true) : deadline(), allowancePolicy: "prepare-approval",
    gas: { maxFeePerGasNativeRaw: natural(maxFee, "maxFeeWei", true), safetyMarginBps: 2000n },
  });
  await assertAmmoraPortableBlockCanonical(context);
  printJson({ plan, configRecipients: { partner: config.partnerRecipient, liquidityPartner: config.liquidityDistribution.partner, leftoverReceiver: config.leftoverReceiver } });
  // An approval run does not create a Config or launch. Re-run against a fresh context.
  await execute(plan.status === "APPROVAL_REQUIRED" ? "approve atomic first buy; replan required" : "register Config, launch and first buy atomically", { client, caller: account, allowedTargets: [plan.status === "APPROVAL_REQUIRED" ? deployment.quoteAsset.token : deployment.contracts.launchFactory] }, plan.transaction);
});
