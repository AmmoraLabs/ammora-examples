/** launch:create-config-and-first-buy -- <deployment> <targets> <policy.json> <saleRaw> <thresholdRaw> <name> <symbol> <uri> <quoteRaw> <minBaseRaw> <maxFeeWei> <deadlineUnix> [reviewHash] */
import { readFile } from "node:fs/promises";
import {
  AmmoraPortableLifecyclePlanner, verifyAmmoraPortableDeploymentAtBlock, assertAmmoraPortableBlockCanonical,
  getAmmoraV4ConfigAtBlock, parseAmmoraV4ConfigCreatedReceipt, parseAmmoraV4LaunchCreatedReceipt,
  parseAmmoraV4SwapReceipt, type AmmoraPortableDeployment, type AmmoraPortableLifecycleTargets,
} from "@ammora-protocol/sdk";
import { caller, natural, validateAction } from "../../shared/actions.js";
import { reader, readBlock, signer, v4Deployment } from "../../shared/env.js";
import { printJson } from "../../shared/input.js";
import { main, send } from "../../shared/run.js";
import { requireHelper } from "../../arl/optional-guards.js";
import { parseTeamRecipientPolicy } from "./policy.js";
import { prepareTeamAtomicFirstBuy, assertAtomicReview } from "./atomic-policy.js";

main(async () => {
  const [deploymentFile, targetsFile, policyFile, sale, threshold, name, symbol, uri, quote, minimum, maxFee, expiry, expectedReview, ...extra] = process.argv.slice(2);
  if (!deploymentFile || !targetsFile || !policyFile || !name || !symbol || !uri || !expiry || extra.length) {
    throw new Error("Supply reviewed manifests, team policy, economics, metadata, first-buy amounts, gas and explicit deadline; add reviewHash only after preview");
  }
  if (process.env.AMMORA_READ_RECEIPT?.trim()) throw new Error("Clear AMMORA_READ_RECEIPT; atomic planning requires a fresh snapshot");
  const deployment = JSON.parse(await readFile(deploymentFile, "utf8")) as AmmoraPortableDeployment;
  const targets = JSON.parse(await readFile(targetsFile, "utf8")) as AmmoraPortableLifecycleTargets;
  requireHelper(targets.firstBuyExecutor, "firstBuyExecutor");
  const helper = targets.firstBuyExecutor;
  const policy = parseTeamRecipientPolicy(JSON.parse(await readFile(policyFile, "utf8")));
  const selected = v4Deployment();
  if (deployment.chain.id !== selected.chain.id
    || deployment.contracts.launchFactory.toLowerCase() !== selected.contracts.launch.factory.toLowerCase()
    || deployment.contracts.configRegistry.toLowerCase() !== selected.contracts.launch.configRegistry.toLowerCase()) {
    throw new Error("Manifest differs from selected chain/generation Factory or Registry");
  }
  const account = caller(), client = await reader(), block = await readBlock(client);
  const context = await verifyAmmoraPortableDeploymentAtBlock(client, deployment, block.number);
  const template = await getAmmoraV4ConfigAtBlock(client, deployment.contracts.configRegistry, BigInt(policy.templateId), block.number);
  const reviewed = prepareTeamAtomicFirstBuy(template, policy, {
    chainId: deployment.chain.id, registry: deployment.contracts.configRegistry,
    factory: deployment.contracts.launchFactory, firstBuyExecutor: helper,
  }, {
    account, saleSupplyRaw: natural(sale, "saleRaw", true), quoteThresholdRaw: natural(threshold, "thresholdRaw", true),
    name, symbol, metadataURI: uri, quoteRaw: natural(quote, "quoteRaw", true),
    minimumBaseRaw: natural(minimum, "minBaseRaw", true), maxFeePerGasWei: natural(maxFee, "maxFeeWei", true),
    deadline: natural(expiry, "deadlineUnix", true),
  });
  if (reviewed.parameters.deadline <= block.timestamp) throw new Error("Deadline expired; choose a new deadline and review again");
  if (process.env.AMMORA_SEND === "1") assertAtomicReview(expectedReview, reviewed.reviewHash);
  const plan = await new AmmoraPortableLifecyclePlanner(context, targets).planAtomicFirstBuy(reviewed.parameters);
  await assertAmmoraPortableBlockCanonical(context);
  validateAction(plan.transaction, [plan.status === "APPROVAL_REQUIRED" ? deployment.quoteAsset.token : deployment.contracts.launchFactory]);
  printJson({ mode: process.env.AMMORA_SEND === "1" ? "SEND_REQUESTED" : "UNSIGNED_PREVIEW", ...reviewed, plan });
  if (process.env.AMMORA_SEND !== "1") return;
  const { account: signingAccount, wallet } = signer();
  if (signingAccount.address.toLowerCase() !== account.toLowerCase()) throw new Error("Signer differs from reviewed Config owner/Creator");
  const hash = await send(plan.status === "APPROVAL_REQUIRED" ? "approve first buy; replan required" : "create partner Config, launch and first buy", plan.transaction, wallet, signingAccount, client);
  if (plan.status === "APPROVAL_REQUIRED") {
    printJson({ hash, status: "APPROVAL_CONFIRMED", replanAfterApproval: true, launchCreated: false });
    return;
  }
  // Use actual receipt identities; registry IDs/predicted addresses can move after preview.
  const receipt = await client.getTransactionReceipt({ hash });
  const config = parseAmmoraV4ConfigCreatedReceipt(receipt, deployment.contracts.configRegistry);
  const launch = parseAmmoraV4LaunchCreatedReceipt(receipt, deployment.contracts.launchFactory);
  const swap = parseAmmoraV4SwapReceipt(receipt, launch.curve);
  if (launch.configId !== config.configId || launch.configHash !== config.configHash
    || launch.creator.toLowerCase() !== account.toLowerCase()
    || swap.trader.toLowerCase() !== helper.toLowerCase() || swap.recipient.toLowerCase() !== account.toLowerCase()
    || swap.baseForQuote || swap.requestedAmountIn !== reviewed.parameters.firstBuys[0]!.includedQuoteAmountRaw
    || swap.consumedAmountIn <= 0n || swap.amountOut < reviewed.parameters.firstBuys[0]!.minimumBaseAmountOutRaw) {
    throw new Error(`Atomic receipt mismatch for ${hash}; reconcile this hash, never resend`);
  }
  printJson({ hash, config, launch, swap, receiptEventsVerified: true, payoutVerified: false,
    next: "Reconcile ERC-20 Transfer and receipt-block balances, then save actual Config ID/hash, token and curve; do not rerun creation" });
});
