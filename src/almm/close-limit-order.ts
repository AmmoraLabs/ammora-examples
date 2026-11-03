import { slippage } from "../shared/input.js";
/**
 * Close a resting order: take what filled, take back what did not, collect the fees.
 *
 *   npm run almm:close-limit-order -- <orderId> [cancel]
 *
 * An order is rarely all or nothing. Price can move through part of a bin and back, so
 * an order can sit part filled for as long as you leave it there. `quoteOrder` reports
 * that split, and which of the two closing calls applies depends on it.
 *
 *   fully filled    `claimFilledOrder` pays the output and closes the order
 *   anything else   `cancelOrder` closes it, returning the proceeds *and* the input
 *
 * There is no call that takes the filled part and leaves the rest resting. Claiming
 * requires the order to be complete, and refuses a partial one outright, which reads
 * as SlippageExceeded rather than as a statement about the order's state. So a partly
 * filled order is closed with cancel, and cancel is not only for abandoning something:
 * it is how a partial fill is collected.
 *
 * Cancelling stays opt-in because it ends the order. Leaving it resting so the rest can
 * fill is usually what someone wants, and a script that closed it by default would take
 * that choice away.
 *
 * ── Fees are separate from the fill ───────────────────────────────────────────
 * While it rests, the order is liquidity, and swaps crossing its bin pay it fees.
 * Those accrue whether or not the order ever fills, and they are claimed with
 * their own call. Cancelling an untouched order can still be worth something.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import {
  almmBinPoolAbi,
  almmLimitOrderManagerAbi,
  buildCancelALMMLimitOrder,
  buildClaimALMMLimitOrder,
  buildClaimALMMLimitOrderFee,
} from "@ammora-protocol/sdk";
import { deployment, reader, signer } from "../shared/env.js";
import { amount, main, positionOwner, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

/** Tolerance between reading the payout and claiming it. */
const claimSlippageBps = slippage();

main(async () => {
  const [orderArgument, cancelArgument] = process.argv.slice(2);
  if (!orderArgument || !/^\d+$/.test(orderArgument)) {
    throw new Error("usage: npm run almm:close-limit-order -- <orderId> [cancel]");
  }
  const orderId = BigInt(orderArgument);
  const alsoCancel = cancelArgument === "cancel";

  const { wallet, account } = signer();
  const client = await reader();
  const manager = deployment().contracts.liquidityMarketMaker.limitOrderManager;
  await requireContract(client, "limit order manager", manager);

  const owner = await positionOwner(client, almmLimitOrderManagerAbi, manager, orderId);
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`order ${orderId} belongs to ${owner}, not to you`);
  }

  const order = await client.readContract({
    abi: almmLimitOrderManagerAbi, address: manager, functionName: "orders", args: [orderId],
  }) as readonly unknown[];
  const pool = order[0] as Address;
  const sellBase = Boolean(order[2]);

  const [inputRemaining, outputClaim, filled] = await client.readContract({
    abi: almmLimitOrderManagerAbi, address: manager, functionName: "quoteOrder", args: [orderId],
  }) as readonly [bigint, bigint, boolean];

  const [baseToken, quoteToken] = await Promise.all([
    client.readContract({ abi: almmBinPoolAbi, address: pool, functionName: "baseToken" }),
    client.readContract({ abi: almmBinPoolAbi, address: pool, functionName: "quoteToken" }),
  ]) as [Address, Address];
  const [input, output] = await Promise.all([
    tokenInfo(client, sellBase ? baseToken : quoteToken),
    tokenInfo(client, sellBase ? quoteToken : baseToken),
  ]);

  console.log(`order      ${orderId}`);
  console.log(`pool       ${pool}`);
  console.log(`state      ${filled ? "filled" : inputRemaining > 0n && outputClaim > 0n ? "partly filled" : "untouched"}`);
  console.log(`claimable  ${amount(outputClaim, output.decimals, output.symbol)}`);
  console.log(`still in   ${amount(inputRemaining, input.decimals, input.symbol)}`);
  console.log("");

  const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);

  if (filled) {
    // Quoting and claiming are two calls, and another swap can cross this bin between
    // them. Asking for exactly what was quoted would revert on a busy pool, so the floor
    // sits a little under it.
    const floor = (outputClaim * BigInt(10_000 - claimSlippageBps)) / 10_000n;
    const claim = {
      to: manager,
      ...buildClaimALMMLimitOrder(orderId, floor, account.address, deadline()),
    };
    await preflight(client, account, claim, almmLimitOrderManagerAbi, "claim filled order");
    await send("claim filled order", claim, wallet, account, client);
  } else if (alsoCancel) {
    // Closes the order and returns both sides: whatever filled, and whatever did not.
    const cancel = {
      to: manager,
      ...buildCancelALMMLimitOrder(orderId, account.address, deadline()),
    };
    await preflight(client, account, cancel, almmLimitOrderManagerAbi, "cancel order");
    await send("cancel order", cancel, wallet, account, client);
  } else if (outputClaim > 0n) {
    console.log("  part of this order filled, and claiming needs it to be complete.");
    console.log("  pass `cancel` to close it and take both sides now.");
  } else {
    console.log("  nothing has filled yet; pass `cancel` to withdraw the input");
  }

  // Ask before sending: an order that never had a swap cross it has earned nothing, and
  // claiming zero is a transaction that buys nothing.
  const [feeBase, feeQuote] = await client.readContract({
    abi: almmLimitOrderManagerAbi, address: manager, functionName: "previewOrderFee", args: [orderId],
  }).catch(() => [0n, 0n] as const) as readonly [bigint, bigint];
  if (feeBase > 0n || feeQuote > 0n) {
    await send(
      "claim order fee",
      { to: manager, ...buildClaimALMMLimitOrderFee(orderId, account.address) },
      wallet, account, client,
    );
  } else {
    console.log("  no fees accrued while it rested");
  }
});
