import { writeFileSync, existsSync } from "node:fs";
import type { AmmoraTransaction } from "@ammora-protocol/sdk";
import { type Hash } from "viem";
import { type ActionContext, validateAction } from "./actions.js";
import { signer } from "./env.js";
import { printJson } from "./input.js";

/** A sequential plan, never atomic. Existing progress files are reconciliation-only. */
export async function executeBatch(c: ActionContext, transactions: readonly AmmoraTransaction[], file: string | undefined): Promise<Hash[]> {
  if (!transactions.length || transactions.length > 64) throw new Error("Batch requires 1–64 transactions");
  transactions.forEach(tx => validateAction(tx, c.allowedTargets));
  printJson({ atomic: false, caller: c.caller, transactions, payoutVerified: false });
  if (process.env.AMMORA_SEND !== "1") return [];
  if (!file || existsSync(file)) throw new Error("Provide a NEW progress file; reconcile an existing/unknown batch before continuing");
  const { wallet, account } = signer();
  if (account.address.toLowerCase() !== c.caller.toLowerCase()) throw new Error("Caller/signer mismatch");
  const progress = { chainId: await c.client.getChainId(), caller: c.caller, transactions: transactions.map(tx => ({ ...tx, status: "UNSUBMITTED", nonce: undefined as number | undefined, hash: undefined as Hash | undefined })) };
  if (progress.chainId !== c.client.chain?.id) throw new Error("RPC chain mismatch");
  const save = () => writeFileSync(file, JSON.stringify(progress, (_,v) => typeof v === "bigint" ? v.toString() : v, 2) + "\n", { mode: 0o600 });
  writeFileSync(file, "", { flag: "wx", mode: 0o600 }); save();
  const hashes: Hash[] = [];
  for (const tx of progress.transactions) {
    const latest = await c.client.getTransactionCount({ address: c.caller, blockTag: "latest" });
    const pending = await c.client.getTransactionCount({ address: c.caller, blockTag: "pending" });
    if (latest !== pending) throw new Error("Pending transaction; reconcile before batch continuation");
    await c.client.call({ account: c.caller, to: tx.to, data: tx.data, value: tx.value });
    tx.nonce = pending; tx.status = "SUBMITTING_OR_UNKNOWN"; save();
    tx.hash = await wallet.sendTransaction({ account, chain: wallet.chain, nonce: pending, to: tx.to, data: tx.data, value: tx.value });
    tx.status = "SUBMITTED"; save(); printJson({ transactionHash: tx.hash, nonce: pending });
    const receipt = await c.client.waitForTransactionReceipt({ hash: tx.hash, confirmations: c.client.chain?.id === 91342 ? 13 : 1, retryCount: 0, timeout: 120000, pollingInterval: 6000 });
    if (receipt.status !== "success" || (await c.client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error(`Reconcile ${tx.hash}; batch stopped`);
    tx.status = "CONFIRMED"; save(); hashes.push(tx.hash);
  }
  return hashes;
}
