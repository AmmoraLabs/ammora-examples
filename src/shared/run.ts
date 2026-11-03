// Shared plumbing for sending a planned transaction and reporting what happened.
import type { Account, Address, PublicClient, WalletClient } from "viem";
import type { Abi } from "viem";
import {
  decodeErrorResult,
  erc20Abi,
  formatUnits,
} from "viem";
import { AmmoraSdkError, planERC20Approvals } from "@ammora-protocol/sdk";
import type { AmmoraTransaction } from "@ammora-protocol/sdk";
import { explorerLink, requireSend } from "./env.js";
import { isContractRevert, retryRead } from "./retry.js";

/** Sends one planned transaction and waits for it, failing loudly on a revert.
 * Returns the hash, which is where a caller reads anything the call brought into being. */
export const send = async (
  label: string,
  transaction: AmmoraTransaction,
  wallet: WalletClient,
  account: Account,
  reader: PublicClient,
): Promise<`0x${string}`> => {
  requireSend();
  const [latestNonce, pendingNonce] = await Promise.all([
    reader.getTransactionCount({ address: account.address, blockTag: "latest" }),
    reader.getTransactionCount({ address: account.address, blockTag: "pending" }),
  ]);
  if (latestNonce !== pendingNonce) throw new Error(`Pending transaction at nonce ${latestNonce}; reconcile before sending ${label}`);
  // Simulate the exact request before a signature; sending itself is never retried.
  await reader.call({ account: account.address, ...transaction });
  console.log(`  preparing ${label}: nonce ${pendingNonce}`);
  const hash = await wallet.sendTransaction({
    account,
    nonce: pendingNonce,
    chain: wallet.chain,
    to: transaction.to,
    data: transaction.data,
    ...(transaction.value === undefined ? {} : { value: transaction.value }),
  });
  console.log(`  submitted ${label}: ${explorerLink(hash)}`);
  const receipt = await reader.waitForTransactionReceipt({
    hash, retryCount: 0, timeout: 120_000, pollingInterval: 6000,
    // head-12 must include the receipt before dependent exact-block reads.
    confirmations: reader.chain?.id === 91342 ? 13 : 1,
  });
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${explorerLink(hash)}`);
  const canonical = await reader.getBlock({ blockNumber: receipt.blockNumber });
  if (canonical.hash !== receipt.blockHash) throw new Error(`Noncanonical receipt for ${hash}; reconcile before continuing`);
  console.log(`  ${label}: ${explorerLink(hash)}`);
  return hash;
};

/**
 * Grants exactly what a plan asked for, and nothing beyond it.
 *
 * The SDK returns the amount each spender needs rather than an unlimited allowance, and
 * these examples keep it that way. An approval left open outlives the transaction that
 * needed it.
 */
export const approve = async (
  requirements: Parameters<typeof planERC20Approvals>[2],
  wallet: WalletClient,
  account: Account,
  reader: PublicClient,
): Promise<void> => {
  const plans = await planERC20Approvals(reader, account.address, requirements);
  for (const plan of plans) {
    if (plan.transactions.length === 0) continue;
    let approvalHash: `0x${string}` | undefined;
    for (const transaction of plan.transactions) {
      approvalHash = await send(
        `approve ${plan.requirement.token.slice(0, 10)}`,
        transaction,
        wallet,
        account,
        reader,
      );
    }
    if (!approvalHash) continue;
    const receipt = await reader.getTransactionReceipt({ hash: approvalHash });
    const allowanceAtReceipt = await readAllowanceAtBlock(
      reader,
      account.address,
      plan.requirement.token,
      plan.requirement.spender,
      receipt.blockNumber,
    );
    if (allowanceAtReceipt < plan.requirement.amount) {
      throw new Error(
        `approval confirmed at block ${receipt.blockNumber}, but its allowance is below the requested amount`,
      );
    }
    // GIWA send() already waited until head-12 includes the receipt. Its exact
    // allowance is proven above; do not replace it with an unreadable announced head.
    if (reader.chain?.id !== 91342) await waitForLatestAllowance(
      reader,
      account.address,
      plan.requirement.token,
      plan.requirement.spender,
      plan.requirement.amount,
      receipt.blockNumber,
    );
  }
};

/**
 * Waits until the RPC's unpinned latest-state view catches up with a confirmed approval.
 *
 * The receipt-block read above is the source of truth. This second step only prevents the
 * next planner or simulation from being served an older latest-state snapshot by a
 * load-balanced RPC endpoint.
 */
const waitForLatestAllowance = async (
  reader: PublicClient,
  owner: Address,
  token: Address,
  spender: Address,
  required: bigint,
  receiptBlock: bigint,
): Promise<void> => {
  let observedBlock = receiptBlock - 1n;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const latestBlock = await reader.getBlockNumber({ cacheTime: 0 });
    if (latestBlock >= receiptBlock && latestBlock > observedBlock) {
      observedBlock = latestBlock;
      const allowance = await readAllowanceAtBlock(reader, owner, token, spender, latestBlock);
      if (allowance >= required) return;
    }
    if (attempt < 8) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
  throw new Error(`approval is confirmed at block ${receiptBlock}, but latest state has not caught up; reconcile the existing receipt before any resend`);
};

/**
 * Reads an allowance from one immutable block, allowing one transient transport retry.
 *
 * This is deliberately narrower than `readWithRetry`: `allowance` is a mandatory ERC-20
 * view on every token accepted by Ammora's policy, so a revert or `0x` here is never a
 * useful success result. Deterministic errors are surfaced without a retry.
 */
const readAllowanceAtBlock = async (
  reader: PublicClient,
  owner: Address,
  token: Address,
  spender: Address,
  blockNumber: bigint,
  attempts = 2,
): Promise<bigint> => {
  return readAtBlockWithRetry(blockNumber, () => reader.readContract({
        abi: erc20Abi,
        address: token,
        functionName: "allowance",
        args: [owner, spender],
        blockNumber,
      }), attempts);
};

/**
 * Repeats a mandatory read against one immutable block.
 *
 * GIWA can make a receipt visible before every backend can serve that block's state.
 * Retrying an unpinned `latest` call risks reading an older state and accepting it as
 * truth. The caller supplies the exact block and this helper never moves that target.
 */
export const readAtBlockWithRetry = async <T>(
  blockNumber: bigint,
  read: () => Promise<T>,
  attempts = 2,
): Promise<T> => {
  try {
    return attempts <= 1 ? await read() : await retryRead(read);
  } catch (cause) {
    throw new Error(`read at block ${blockNumber} failed`, { cause });
  }
};

/**
 * Fails with a readable message when an address holds no code.
 *
 * Without this the first read against a plain address surfaces as a decoding error from
 * the RPC layer, which says nothing about what the caller got wrong. Provenance, meaning
 * whether a real contract is the pool it claims to be, is the SDK's job, and it refuses with its
 * own message when the reviewed factory does not recognise it.
 */
export const requireContract = async (
  reader: PublicClient,
  label: string,
  target: Address,
): Promise<void> => {
  const code = await reader.getCode({ address: target });
  if (!code || code === "0x") {
    throw new Error(`${label} ${target} holds no contract on this chain`);
  }
};

/** Token decimals and symbol, read on-chain rather than assumed. */
export const tokenInfo = async (
  reader: PublicClient,
  token: Address,
  blockNumber?: bigint,
): Promise<{ decimals: number; symbol: string }> => {
  const erc20 = [
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
    { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  ] as const;
  const [decimals, symbol] = await Promise.all([
    reader.readContract({ abi: erc20, address: token, functionName: "decimals", blockNumber }),
    reader.readContract({ abi: erc20, address: token, functionName: "symbol", blockNumber }),
  ]);
  return { decimals: Number(decimals), symbol: String(symbol) };
};

export const amount = (value: bigint, decimals: number, symbol: string): string =>
  `${formatUnits(value, decimals)} ${symbol}`;

/**
 * Reads a pool's state, and says so plainly when the address is not that kind of pool.
 *
 * Reads do not move value, so the SDK's provenance check does not run on them. An
 * address that holds a contract but not a pool therefore fails on a missing function,
 * and viem reports that as a paragraph about `baseToken` returning no data, which
 * describes the symptom and not the mistake.
 *
 * The write paths still prove the pool against the reviewed factory before planning.
 * This only makes the read that comes first legible.
 */
export const asPool = async <T>(
  pool: Address,
  kind: string,
  read: () => Promise<T>,
): Promise<T> => read().catch((cause: unknown) => {
  if (!isContractRevert(cause)) throw cause;
  throw new Error(
    `${pool} does not answer as ${kind} on this chain.`
    + " Check the address and that AMMORA_CHAIN_ID matches where it lives.",
  );
});

/**
 * Reads a position's owner, and says the position does not exist when it does not.
 *
 * `ownerOf` reverts for an id that was never minted or has been burned. viem renders
 * that as a paragraph about a contract call returning no data, which reads as though
 * the manager address were wrong rather than the id.
 */
export const positionOwner = async (
  reader: PublicClient,
  abi: Abi,
  manager: Address,
  tokenId: bigint,
): Promise<Address> => reader.readContract({
  abi, address: manager, functionName: "ownerOf", args: [tokenId],
}).then((owner) => owner as Address).catch((cause: unknown) => {
  if (!isContractRevert(cause)) throw cause;
  throw new Error(`position ${tokenId} does not exist on ${manager}`);
});

/**
 * Reads something about a position, and blames the id when the read fails.
 *
 * The managers revert for an id that was never minted, and the SDK surfaces that as
 * whichever call happened to be first. Naming the position is what tells a caller the
 * argument was wrong rather than the deployment.
 */
export const aboutPosition = async <T>(
  tokenId: bigint,
  read: () => Promise<T>,
): Promise<T> => read().catch((cause: unknown) => {
  if (!isContractRevert(cause)) throw cause;
  throw new Error(`position ${tokenId} could not be read; check the id and that you hold it`);
});

/**
 * Runs a transaction as a call first, and names the revert if it fails.
 *
 * Worth doing whenever you hold calldata rather than a plan. The SDK's plan methods
 * validate as they build, so a bad one usually throws in TypeScript; a bare encoder
 * hands back bytes that only fail once they are on chain, where the money has already
 * gone to gas.
 *
 * Passing the contract's ABI is what makes the failure readable. Without the error
 * definitions in it, viem reports "execution reverted" and nothing else, so a missed
 * slippage floor is indistinguishable from a malformed argument.
 */
export const preflight = async (
  reader: PublicClient,
  account: Account,
  transaction: { to: Address; data: `0x${string}`; value?: bigint },
  abi: Abi,
  label: string,
  minimumBlock?: bigint,
): Promise<void> => {
  const blockNumber = await reader.getBlockNumber({ cacheTime: 0 });
  if (minimumBlock !== undefined && blockNumber < minimumBlock) {
    throw new Error(`RPC head ${blockNumber} has not reached dependency block ${minimumBlock}`);
  }
  try {
    await retryRead(() => reader.call({ account: account.address, blockNumber, ...transaction }));
  } catch (error: unknown) {
    const nested = error as { data?: unknown; cause?: { data?: unknown; cause?: { data?: unknown } } };
    const raw = nested?.cause?.cause?.data ?? nested?.cause?.data ?? nested?.data;
    if (typeof raw === "string" && raw.length >= 10) {
      let decoded: { errorName: string; args?: readonly unknown[] };
      try {
        decoded = decodeErrorResult({ abi, data: raw as `0x${string}` });
      } catch {
        throw new Error(`${label} would revert with unknown selector ${raw.slice(0, 10)}`, { cause: error });
      }
      const detail = decoded.args?.length ? `: ${decoded.args.map(String).join(", ")}` : "";
      throw new Error(`${label} would revert with ${decoded.errorName}${detail}`, { cause: error });
    }
    throw error;
  }
};

/**
 * Retries a read through transient RPC trouble, backing off between attempts.
 *
 * Public endpoints rate-limit, and anything that walks a few hundred token ids will
 * meet that limit. A revert is never retried: it is an answer, not a failure, and
 * repeating it only wastes the budget that the retries are there to protect.
 */
export const readWithRetry = async <T>(read: () => Promise<T>, attempts = 2): Promise<T> =>
  attempts <= 1 ? read() : retryRead(read);

/** Wraps an example's body so a failure prints a usable message, not a stack. */
export const main = (run: () => Promise<void>): void => {
  run().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(`\n${describeError(error)}`);
      process.exit(1);
    },
  );
};

/**
 * Turns a failure into one line a reader can act on.
 *
 * Most errors here are already written as sentences and pass through. The exception is
 * anything the transport raises: a public endpoint refusing a burst renders as a dozen
 * lines about a JSON-RPC request, which buries the one fact that matters, that nothing
 * is wrong with the call and it should be tried again more slowly.
 */
export const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const rootCause = error instanceof AmmoraSdkError
    ? (typeof error.details?.cause === "string" ? error.details.cause
      : error.cause instanceof Error ? error.cause.message : undefined)
    : undefined;
  if (error instanceof AmmoraSdkError && rootCause !== undefined) {
    // The SDK preserves the actual trust failure here rather than Error.cause.
    // Keep its first line, with endpoint URLs redacted, so a missing contract is
    // distinguishable from provider trouble without exposing custom RPC credentials.
    const detail = rootCause.split("\n")[0]!.replace(/https?:\/\/\S+/g, "[RPC URL]");
    return `${error.message} (${error.code})\n  ${detail}`;
  }
  const text = error.message;
  if (/over rate limit|429|too many requests/i.test(text)) {
    return "The RPC endpoint is rate limiting requests. Preserve any submitted hash and reconcile its nonce, receipt and canonical state before resuming."
      + " Increase AMMORA_RPC_INTERVAL_MS or set AMMORA_RPC_URL to a provider with sufficient capacity; never blindly resend.";
  }
  if (/RPC Request failed|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(text)) {
    return `Could not reach the RPC endpoint. Check AMMORA_RPC_URL and your connection.\n  ${text.split("\n")[0]}`;
  }
  return text;
};
