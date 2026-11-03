import { ammoraAFSVaultAbi, feeVaultAbi } from "@ammora-protocol/sdk";
import { decodeFunctionData, erc20Abi, parseEventLogs, zeroAddress,
  type Address, type Hash, type PublicClient, type TransactionReceipt } from "viem";
import { readAtBlockWithRetry } from "./run.js";

/** Single direct claim. LP managers, batches and delegate contracts have separate verifiers. */
export type FeePayment = {
  kind: "launch" | "dfs";
  hash: Hash;
  vault: Address;
  token: Address;
  beneficiary: Address;
  payout: Address;
  index?: number;
};
const same = (a: string | null, b: string): boolean => a?.toLowerCase() === b.toLowerCase();
const requireMatch = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

/** Binds the successful receipt to the expected caller, calldata, event and ERC-20 payment. */
export function verifyFeePaymentReceipt(
  receipt: TransactionReceipt,
  input: `0x${string}`,
  expected: FeePayment,
) {
  const e = expected;
  requireMatch(e.payout !== zeroAddress && !same(e.payout, e.vault), "Payout must be nonzero and outside the vault");
  requireMatch(receipt.status === "success" && same(receipt.transactionHash, e.hash)
    && same(receipt.to, e.vault) && same(receipt.from, e.beneficiary), "Claim receipt identity/status mismatch");
  requireMatch(receipt.logs.every(log => !log.removed && same(log.transactionHash, e.hash)
    && same(log.blockHash, receipt.blockHash) && log.blockNumber === receipt.blockNumber), "Claim log identity mismatch");
  const logs = receipt.logs.filter(log => same(log.address, e.vault));
  let gross: bigint, net: bigint;
  if (e.kind === "launch") {
    const call = decodeFunctionData({ abi: feeVaultAbi, data: input });
    requireMatch(call.functionName === "claimFor" && same(String(call.args?.[0]), e.token)
      && same(String(call.args?.[1]), e.beneficiary) && same(String(call.args?.[2]), e.payout), "Claim calldata mismatch");
    const events = parseEventLogs({ abi: feeVaultAbi, eventName: "ClaimedFor", logs, strict: true });
    const event = events[0]?.args;
    requireMatch(events.length === 1 && !!event && same(event.token, e.token)
      && same(event.beneficiary, e.beneficiary) && same(event.recipient, e.payout)
      && same(event.caller, e.beneficiary), "Expected exactly one matching ClaimedFor event");
    gross = event!.amount;
    // FeeVault reports the gross transfer. Net receipt is established by token transfers below.
    net = transferCredit(receipt.logs, e.token, e.vault, e.payout);
  } else {
    requireMatch(Number.isInteger(e.index) && e.index! >= 0 && e.index! <= 255, "DFS index must fit uint8");
    const call = decodeFunctionData({ abi: ammoraAFSVaultAbi, data: input });
    requireMatch(call.functionName === "claimTo" && Number(call.args?.[0]) === e.index
      && same(String(call.args?.[1]), e.payout), "Claim calldata mismatch");
    const events = parseEventLogs({ abi: ammoraAFSVaultAbi, eventName: "FeeClaimedGross", logs, strict: true });
    const event = events[0]?.args;
    requireMatch(events.length === 1 && !!event && event.index === e.index
      && same(event.recipient, e.beneficiary) && same(event.receiver, e.payout), "Expected exactly one matching FeeClaimedGross event");
    gross = event!.grossAmount;
    net = event!.netAmount;
  }
  requireMatch(gross > 0n && net > 0n && net <= gross, "Zero payment or invalid gross/net claim; not a positive payout");
  requireMatch(transferCredit(receipt.logs, e.token, e.vault, e.payout) === net, "Claim transfer does not match net payment");
  requireMatch(transferDelta(receipt.logs, e.token, e.payout) === net, "Other receipt transfers prevent isolated payout verification");
  return { grossAmount: gross, netAmount: net };
}

function transferCredit(logs: TransactionReceipt["logs"], token: Address, vault: Address, payout: Address): bigint {
  return parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: logs.filter(log => same(log.address, token)), strict: true })
    .filter(log => same(log.args.from, vault) && same(log.args.to, payout))
    .reduce((sum, log) => sum + log.args.value, 0n);
}
export function transferDelta(logs: TransactionReceipt["logs"], token: Address, payout: Address): bigint {
  return parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: logs.filter(log => same(log.address, token)), strict: true })
    .reduce((sum, log) => sum + (same(log.args.to, payout) ? log.args.value : 0n)
      - (same(log.args.from, payout) ? log.args.value : 0n), 0n);
}

/** Read-only reconciliation. Balances are block-end values, so reconcile *all* token transfers
 * in that block; a concurrent incoming/outgoing payment must not be attributed to this claim. */
export async function verifyFeePayment(client: PublicClient, expected: FeePayment) {
  try {
    const receipt = await client.getTransactionReceipt({ hash: expected.hash });
    const tx = await client.getTransaction({ hash: expected.hash });
    requireMatch(same(tx.hash, expected.hash) && same(tx.blockHash, receipt.blockHash), "Transaction/receipt mismatch");
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    requireMatch(same(block.hash, receipt.blockHash) && receipt.blockNumber > 0n, "Noncanonical claim receipt");
    const amounts = verifyFeePaymentReceipt(receipt, tx.input, expected);
    const parentNumber = receipt.blockNumber - 1n;
    const parent = await client.getBlock({ blockNumber: parentNumber });
    requireMatch(same(parent.hash, block.parentHash), "Noncanonical claim parent");
    const balance = (blockNumber: bigint) => readAtBlockWithRetry(blockNumber, () => client.readContract({
      abi: erc20Abi, address: expected.token, functionName: "balanceOf", args: [expected.payout], blockNumber,
    }));
    const before = await balance(parentNumber);
    const after = await balance(receipt.blockNumber);
    const logs = await client.getLogs({ address: expected.token, blockHash: receipt.blockHash });
    requireMatch(logs.every(log => !log.removed && same(log.blockHash, receipt.blockHash)
      && log.blockNumber === receipt.blockNumber), "Noncanonical transfer logs");
    const blockTransferDelta = transferDelta(logs, expected.token, expected.payout);
    // Also require the block log response to contain every payment-token log of the receipt.
    for (const log of receipt.logs.filter(log => same(log.address, expected.token))) {
      requireMatch(logs.some(found => found.logIndex === log.logIndex && same(found.transactionHash, expected.hash)
        && found.data === log.data && found.topics.join() === log.topics.join()), "Incomplete block transfer logs");
    }
    requireMatch(after - before === blockTransferDelta, "Receipt-block balance does not reconcile with token transfers (nonstandard token or incomplete RPC data)");
    const canonical = await client.getBlock({ blockNumber: receipt.blockNumber });
    requireMatch(same(canonical.hash, receipt.blockHash), "Claim block changed during reconciliation");
    return { ...expected, ...amounts, executionConfirmed: true, payoutVerified: true,
      blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, balanceBefore: before, balanceAfter: after,
      blockBalanceDelta: after - before, blockTransferDelta,
      otherBlockTransferDelta: blockTransferDelta - amounts.netAmount,
      balanceIncreased: after > before, scope: "Direct claim receipt credit and whole-block ERC-20 balance reconciliation" };
  } catch (cause) {
    throw new Error(`Payment verification incomplete for ${expected.hash}. Do not resend the claim. Reconcile this hash with fees:verify-claim; execution and payment verification are separate.`, { cause });
  }
}
