/** npm run launch:team-config -- preview|create <policy.json> <saleSupplyRaw> <quoteThresholdRaw> [reviewHash] */
import { readFile } from "node:fs/promises";
import { buildCreateAmmoraV4Config, getAmmoraV4ConfigAtBlock, parseAmmoraV4ConfigCreatedReceipt, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { readBlock, reader, signer, v4Deployment } from "../../shared/env.js";
import { printJson, rawAmount } from "../../shared/input.js";
import { main, send } from "../../shared/run.js";
import { assertTeamConfigReview, parseTeamRecipientPolicy, planTeamConfig } from "./policy.js";

main(async () => {
  const [mode, path, supplyArg, thresholdArg, expectedReview, ...extra] = process.argv.slice(2);
  if (!path || !["preview", "create"].includes(mode ?? "") || extra.length || (mode === "preview" && expectedReview) || (mode === "create" && !expectedReview)) {
    throw new Error("usage: preview <policy.json> <saleSupplyRaw> <quoteThresholdRaw> OR create <policy.json> <saleSupplyRaw> <quoteThresholdRaw> <reviewHash>");
  }
  const policy = parseTeamRecipientPolicy(JSON.parse(await readFile(path, "utf8")));
  const saleSupply = rawAmount(supplyArg, "saleSupplyRaw");
  const threshold = rawAmount(thresholdArg, "quoteThresholdRaw");
  const client = await reader();
  const launch = v4Deployment().contracts.launch;
  if (client.chain?.id !== policy.chainId || launch.configRegistry.toLowerCase() !== policy.registry.toLowerCase()) throw new Error("recipient policy chain/registry does not match the selected deployment");
  const block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy }, block.number);
  const template = await getAmmoraV4ConfigAtBlock(client, launch.configRegistry, BigInt(policy.templateId), block.number);
  const plan = planTeamConfig(template, policy, { chainId: policy.chainId, registry: launch.configRegistry }, saleSupply, threshold);
  printJson({ mode, blockNumber: block.number, blockHash: block.hash, snapshot: block.snapshot, policy, ...plan,
    note: "Creates a new immutable Config. All template fee rates, vesting and LP ratios are preserved. Review every selected recipient and the complete policy. A matching reviewHash is required before loading a signer. No token is created by this command.",
  });
  if (mode === "preview") return;
  assertTeamConfigReview(expectedReview, plan.reviewHash);
  const { wallet, account } = signer();
  const hash = await send("create team Config", plan.transaction, wallet, account, client);
  const receipt = await client.getTransactionReceipt({ hash });
  const created = parseAmmoraV4ConfigCreatedReceipt(receipt, launch.configRegistry);
  const confirmed = await getAmmoraV4ConfigAtBlock(client, launch.configRegistry, created.configId, receipt.blockNumber);
  const actual = buildCreateAmmoraV4Config(confirmed.config, confirmed.segments, policy.configOwner);
  if (actual.data !== plan.transaction.data || confirmed.configHash !== created.configHash
    || confirmed.identity.owner.toLowerCase() !== policy.configOwner.toLowerCase()
    || confirmed.identity.feeClaimer.toLowerCase() !== policy.partnerRecipient.toLowerCase()) {
    throw new Error("receipt-bound team Config does not match the reviewed calldata policy");
  }
  printJson({ hash, blockNumber: receipt.blockNumber, ...created, recipients: plan.recipients });
});
