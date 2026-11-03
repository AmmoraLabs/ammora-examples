import { erc20Abi, parseEventLogs, type Address, type Hash, type PublicClient } from "viem";
import { transferDelta } from "../shared/fee-payment.js";

/** Proof for a known, separately authenticated call. Reconcile the whole block, not just its receipt. */
export async function tokenCredit(client: PublicClient, hash: Hash, token: Address, payout: Address) {
  const receipt = await client.getTransactionReceipt({ hash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (receipt.status !== "success" || block.hash !== receipt.blockHash) throw new Error(`Reconcile ${hash}; never resend`);
  const amount = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs.filter(l => l.address.toLowerCase() === token.toLowerCase()) })
    .filter(l => l.args.to.toLowerCase() === payout.toLowerCase()).reduce((n, l) => n + l.args.value, 0n);
  if (amount === 0n) return { hash, token, payout, amount, payoutVerified: false, reason: "NO_POSITIVE_TOKEN_TRANSFER" };
  const parent = await client.getBlock({ blockNumber: receipt.blockNumber - 1n });
  if (parent.hash !== block.parentHash) throw new Error(`Noncanonical parent for ${hash}`);
  const [before, after, logs] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [payout], blockNumber: receipt.blockNumber - 1n }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [payout], blockNumber: receipt.blockNumber }),
    client.getLogs({ address: token, blockHash: receipt.blockHash }),
  ]);
  if (logs.some(l => l.removed || l.blockHash !== receipt.blockHash)) throw new Error("Noncanonical token logs");
  for (const log of receipt.logs.filter(l => l.address.toLowerCase() === token.toLowerCase())) {
    if (!logs.some(l => l.transactionHash === hash && l.logIndex === log.logIndex && l.data === log.data && l.topics.join() === log.topics.join())) throw new Error("Incomplete block logs");
  }
  const blockTransferDelta = transferDelta(logs, token, payout);
  if (after - before !== blockTransferDelta || (await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error(`Balance/canonicality mismatch for ${hash}; do not resend`);
  return { hash, token, payout, amount, before, after, blockTransferDelta, otherBlockTransferDelta: blockTransferDelta - amount,
    blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, payoutVerified: true, balanceIncreased: after > before };
}
