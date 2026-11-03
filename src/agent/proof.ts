import { feeVaultAbi } from "@ammora-protocol/sdk";
import { decodeFunctionData, erc20Abi, parseEventLogs, type Address, type PublicClient, type TransactionReceipt } from "viem";
import { invariant, same } from "./schema.js";

export function transferDelta(logs: TransactionReceipt["logs"], token: Address, payout: Address) {
  return parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: logs.filter(l => same(l.address, token)), strict: true })
    .reduce((n, l) => n + (same(l.args.to, payout) ? l.args.value : 0n) - (same(l.args.from, payout) ? l.args.value : 0n), 0n);
}

/** Attribute this receipt separately from other transfers in the same block. */
export async function tokenBalanceProof(client: PublicClient, receipt: TransactionReceipt, token: Address, account: Address) {
  const bn = receipt.blockNumber;
  invariant(bn > 0n, "INVALID_RECEIPT_BLOCK");
  const block = await client.getBlock({ blockNumber: bn }), parent = await client.getBlock({ blockNumber: bn - 1n });
  invariant(block.hash === receipt.blockHash && block.parentHash === parent.hash, "NONCANONICAL_PAYMENT_BLOCK");
  const code = await client.getCode({ address: token, blockNumber: bn - 1n });
  const before = !code || code === "0x" ? 0n : await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account], blockNumber: bn - 1n });
  const after = await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account], blockNumber: bn });
  const logs = await client.getLogs({ address: token, blockHash: receipt.blockHash });
  invariant(logs.every(l => !l.removed && l.blockHash === receipt.blockHash && l.blockNumber === bn), "INVALID_BLOCK_LOGS");
  for (const log of receipt.logs.filter(l => same(l.address, token))) {
    invariant(logs.some(l => l.logIndex === log.logIndex && l.transactionHash === receipt.transactionHash && l.data === log.data && l.topics.join() === log.topics.join()), "INCOMPLETE_BLOCK_LOGS");
  }
  const receiptDelta = transferDelta(receipt.logs, token, account), blockDelta = transferDelta(logs, token, account);
  invariant(after - before === blockDelta, "TOKEN_BALANCE_TRANSFER_MISMATCH");
  return { token, account, beforeRaw: String(before), afterRaw: String(after), receiptDeltaRaw: String(receiptDelta), blockDeltaRaw: String(blockDelta), otherBlockDeltaRaw: String(blockDelta - receiptDelta), balanceIncreased: after > before };
}

export function positiveTransfer(receipt: TransactionReceipt, token: Address, recipient: Address) {
  return parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs.filter(l => same(l.address, token)), strict: true })
    .filter(l => same(l.args.to, recipient)).reduce((sum, l) => sum + l.args.value, 0n);
}

/** Agent-local verifier with no environment/CLI signer imports. */
export async function launchFeeProof(client: PublicClient, receipt: TransactionReceipt, token: Address, beneficiary: Address, payout: Address) {
  invariant(receipt.status === "success" && receipt.logs.every(l => !l.removed && l.blockHash === receipt.blockHash && l.blockNumber === receipt.blockNumber && l.transactionHash === receipt.transactionHash), "CLAIM_RECEIPT_IDENTITY_MISMATCH");
  invariant(receipt.to && same(receipt.from, beneficiary), "CLAIM_CALLER_MISMATCH");
  const tx = await client.getTransaction({ hash: receipt.transactionHash });
  const call = decodeFunctionData({ abi: feeVaultAbi, data: tx.input });
  invariant(call.functionName === "claimFor" && same(String(call.args?.[0]), token) && same(String(call.args?.[1]), beneficiary) && same(String(call.args?.[2]), payout), "CLAIM_CALLDATA_MISMATCH");
  const events = parseEventLogs({ abi: feeVaultAbi, eventName: "ClaimedFor", logs: receipt.logs.filter(l => same(l.address, receipt.to!)), strict: true });
  const e = events[0]?.args;
  invariant(events.length === 1 && e && same(e.token, token) && same(e.beneficiary, beneficiary) && same(e.recipient, payout) && same(e.caller, beneficiary) && e.amount > 0n, "CLAIM_EVENT_MISMATCH");
  const direct = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs.filter(l => same(l.address, token)), strict: true })
    .filter(l => same(l.args.from, receipt.to!) && same(l.args.to, payout)).reduce((n, l) => n + l.args.value, 0n);
  invariant(direct > 0n && direct <= e.amount, "NO_POSITIVE_CLAIM_TRANSFER");
  const balance = await tokenBalanceProof(client, receipt, token, payout);
  invariant(BigInt(balance.receiptDeltaRaw) === direct, "CLAIM_BALANCE_MISMATCH");
  return { token, beneficiary, payout, grossAmountRaw: String(e.amount), netAmountRaw: String(direct), balance, payoutVerified: true };
}
