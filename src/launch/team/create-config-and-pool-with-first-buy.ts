/** launch:create-config-and-pool-with-first-buy -- <policy.json> <saleRaw> <thresholdRaw> <name> <symbol> <uri> <quoteRaw> <minBaseRaw> <maxFeeWei> <deadlineUnix> [reviewHash] */
import { readFile } from "node:fs/promises";
import {
  parseAmmoraV4ConfigCreatedReceipt, parseAmmoraV4LaunchCreatedReceipt,
  parseAmmoraV4SwapReceipt,
} from "@ammora-protocol/sdk";
import { caller, natural, validateAction } from "../../shared/actions.js";
import { reader, readBlock, signer, v4Deployment } from "../../shared/env.js";
import { printJson } from "../../shared/input.js";
import { main, send } from "../../shared/run.js";
import { parseTeamRecipientPolicy } from "./policy.js";
import { assertAtomicReview } from "./atomic-policy.js";
import { requireAtomicCatalogAPI, planTeamAtomicFromCatalog } from "./builtin-first-buy.js";

main(async () => {
  requireAtomicCatalogAPI(); // Refuse unsupported installed SDK before any RPC or key access.
  const [policyFile, sale, threshold, name, symbol, uri, quote, minimum, maxFee, expiry, expectedReview, ...extra] = process.argv.slice(2);
  if (!policyFile || !name || !symbol || !uri || !expiry || extra.length) {
    throw new Error("Supply team policy, economics, metadata, first-buy amounts, gas and explicit deadline; add reviewHash only after preview");
  }
  if (process.env.AMMORA_READ_RECEIPT?.trim()) throw new Error("Clear AMMORA_READ_RECEIPT; atomic planning requires a fresh snapshot");
  const policy = parseTeamRecipientPolicy(JSON.parse(await readFile(policyFile, "utf8")));
  const selected = v4Deployment();
  if (selected.chain.id !== 91342 || process.env.AMMORA_GIWA_GENERATION !== "auto-route") {
    throw new Error("Select GIWA auto-route");
  }
  const account = caller(), client = await reader(), block = await readBlock(client);
  const { deployment, helper, reviewed, plan } = await planTeamAtomicFromCatalog(client, block.number, policy, {
    account, saleSupplyRaw: natural(sale, "saleRaw", true), quoteThresholdRaw: natural(threshold, "thresholdRaw", true),
    name, symbol, metadataURI: uri, quoteRaw: natural(quote, "quoteRaw", true),
    minimumBaseRaw: natural(minimum, "minBaseRaw", true), maxFeePerGasWei: natural(maxFee, "maxFeeWei", true),
    deadline: natural(expiry, "deadlineUnix", true),
  });
  if (reviewed.parameters.deadline <= block.timestamp) throw new Error("Deadline expired; choose a new deadline and review again");
  if (process.env.AMMORA_SEND === "1") assertAtomicReview(expectedReview, reviewed.reviewHash);
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
