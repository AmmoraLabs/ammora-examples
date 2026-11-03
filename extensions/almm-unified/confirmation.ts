import type { Hash, PublicClient, TransactionReceipt } from "viem";
/** Refresh a receipt after confirmation waiting: an initial preconfirmation hash may change. */
export async function refreshCanonicalReceipt(client: PublicClient, hash: Hash, observed: TransactionReceipt, confirmations = 13) {
  if (!Number.isSafeInteger(confirmations) || confirmations < 1) throw new Error("Positive confirmation count required");
  if (observed.transactionHash !== hash || observed.status !== "success") throw new Error("Observed transaction failed or differs; reconcile, never resend");
  const receipt = await client.getTransactionReceipt({ hash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const head = await client.getBlockNumber({ cacheTime: 0 });
  if (receipt.transactionHash !== hash || receipt.status !== "success" || receipt.logs.some(log => log.removed)
    || block.number !== receipt.blockNumber || block.hash !== receipt.blockHash
    || head < receipt.blockNumber + BigInt(confirmations - 1)) throw new Error("Receipt is not canonical with enough confirmations; reconcile, never resend");
  return { receipt, confirmation: { observedBlockNumber: observed.blockNumber, observedBlockHash: observed.blockHash,
    canonicalBlockNumber: receipt.blockNumber, canonicalBlockHash: receipt.blockHash, head,
    confirmations: head - receipt.blockNumber + 1n, refreshed: true as const } };
}
