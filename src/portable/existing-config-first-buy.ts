/** portable:existing-config-first-buy -- <deployment> <targets> <configId> <expectedConfigHash> <name> <symbol> <uri> <decimals> <quoteRaw> <minimumBaseRaw> <maxFeeWei> [deadlineUnix]. */
import { readFile } from "node:fs/promises";
import { AmmoraPortableLifecyclePlanner, verifyAmmoraPortableDeploymentAtBlock, assertAmmoraPortableBlockCanonical, type AmmoraPortableDeployment, type AmmoraPortableLifecycleTargets } from "@ammora-protocol/sdk";
import type { Hex } from "viem";
import { caller, deadline, execute, natural } from "../shared/actions.js";
import { reader, readBlock } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { requireHelper } from "../arl/optional-guards.js";
import { main } from "../shared/run.js";

main(async () => {
  const [deploymentFile, targetsFile, configId, expectedHash, name, symbol, uri, decimals, quote, minimum, maxFee, expiry] = process.argv.slice(2);
  if (!deploymentFile || !targetsFile || !name || !symbol || !uri || !/^0x[0-9a-fA-F]{64}$/.test(expectedHash ?? "")) throw new Error("Supply reviewed manifests, Config ID/hash, launch metadata, decimals, first-buy amounts and gas limit");
  const deployment = JSON.parse(await readFile(deploymentFile, "utf8")) as AmmoraPortableDeployment;
  const targets = JSON.parse(await readFile(targetsFile, "utf8")) as AmmoraPortableLifecycleTargets;
  requireHelper(targets.firstBuyExecutor, "firstBuyExecutor");
  const client = await reader(), block = await readBlock(client), account = caller();
  const context = await verifyAmmoraPortableDeploymentAtBlock(client, deployment, block.number);
  const plan = await new AmmoraPortableLifecyclePlanner(context, targets).planExistingConfigAtomicFirstBuy({
    account, configId: natural(configId, "configId", true), expectedConfigHash: expectedHash as Hex,
    launch: { name, symbol, metadataURI: uri, creatorMetadataURI: uri, tokenDecimals: integer(decimals ?? "", "decimals", 6, 9) },
    firstBuys: [{ includedQuoteAmountRaw: natural(quote, "quoteRaw", true), minimumBaseAmountOutRaw: natural(minimum, "minimumBaseRaw", true), allowPartialFill: false, recipient: account }],
    deadline: expiry ? natural(expiry, "deadlineUnix", true) : deadline(), allowancePolicy: "prepare-approval",
    gas: { maxFeePerGasNativeRaw: natural(maxFee, "maxFeeWei", true), safetyMarginBps: 2000n },
  });
  await assertAmmoraPortableBlockCanonical(context);
  printJson(plan);
  await execute(plan.status === "APPROVAL_REQUIRED" ? "approve existing-Config first buy; replan required" : "launch and first buy from hash-bound Config", { client, caller: account, allowedTargets: [plan.status === "APPROVAL_REQUIRED" ? deployment.quoteAsset.token : deployment.contracts.launchFactory] }, plan.transaction);
});
