import { unifiedManifest, requiresExposureReview } from "./roles.js";
import { writeFileSync } from "node:fs";
import { unifiedContext } from "./context.js";
import { buildUnified, type Operation } from "./operations.js";
import { addr, digest, json, load, obj } from "../../src/stablecoin/manifest.js";
import { main } from "../../src/shared/run.js";
const operations = ["policy", "register-approve", "register", "create", "discover", "approve", "seed", "swap", "inspect", "grant", "revoke", "claim", "exit", "close"];
main(async () => {
  const [operation, manifestFile, requestFile, output] = process.argv.slice(2);
  if (!operation || !operations.includes(operation)) throw new Error("Choose: " + operations.join(", "));
  const m = unifiedManifest(load(manifestFile)), r = obj(load(requestFile), ["pool", "tokenId", "binStepBps", "maximumBaseRaw", "maximumQuoteRaw", "lowerBinId", "upperBinId", "includedAmountIn", "baseForQuote", "slippageBps", "deadline", "delegate", "recipient", "expiresAt", "recipientMode", "revokeAll", "binIds", "token", "spender", "amount"]);
  const caller = addr(process.env.AMMORA_ACCOUNT ?? m.roles.liquidityOwner), pool = r.pool === undefined ? undefined : addr(r.pool);
  const c = await unifiedContext(m, caller, pool, requiresExposureReview(operation, r));
  const p = await buildUnified(c, operation as Operation, r);
  const body = { schemaVersion: 1, operation, caller, manifest: m, request: r, block: { number: c.block.number, hash: c.block.hash }, expiresAt: c.block.timestamp + BigInt(m.policy.planTtlSeconds), transactions: p.transactions, approvals: p.approvals, payout: p.payout ?? null, ...(p.registryProbe ? { registryProbe: p.registryProbe } : {}) };
  const plan = { ...body, reviewHash: digest(body), summary: p.summary, publicSDK: "0.3.8", additiveAdapterPublished: false, mode: "UNSIGNED_PREVIEW", payoutVerified: false };
  if (output) writeFileSync(output, json(plan) + "\n", { flag: "wx" });
  console.log(json(plan));
});
