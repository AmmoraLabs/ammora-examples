import { tokenAmount } from "../shared/input.js";
/**
 * Quote a swap on a bin (ALMM) pool. Reads only, so no key is required.
 *
 *   npm run almm:quote-swap -- <poolAddress> <amountIn> [base-for-quote]
 *
 * Start here: it shows what the SDK will price a swap at, and what slippage bound the
 * swap example would send, without putting anything on chain.
 */
import { ALMMClient, minOutFromSlippage } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader } from "../shared/env.js";
import { amount, main, requireContract, tokenInfo } from "../shared/run.js";

main(async () => {
  const [poolArgument, amountArgument, directionArgument] = process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (!amountArgument) {
    throw new Error("pass an input amount: npm run almm:quote-swap -- <pool> <amountIn> [base-for-quote]");
  }
  const baseForQuote = directionArgument === "base-for-quote";

  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "pool", pool);
  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());

  // Reads do not move value, so the SDK's provenance check does not run on this path.
  // A contract that is not a bin pool simply fails to answer; say which read broke.
  const state = await sdk.getPoolState().catch(() => {
    throw new Error(
      `${pool} does not answer as a bin pool. Check the address, or use almm:swap, which `
      + "proves the pool against the reviewed factory before planning",
    );
  });
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);
  const input = baseForQuote ? base : quote;
  const output = baseForQuote ? quote : base;
  const includedAmountIn = tokenAmount(amountArgument, input.decimals);

  const quoted = await sdk.quoteExactInput(includedAmountIn, baseForQuote);

  console.log(`pool      ${pool}`);
  console.log(`pair      ${base.symbol} / ${quote.symbol}  (bin step ${state.binStepBps} bps)`);
  console.log(`active id ${state.activeId}, current fee ${state.currentFeeBps} bps`);
  console.log("");
  console.log(`in        ${amount(includedAmountIn, input.decimals, input.symbol)}`);
  console.log(`out       ${amount(quoted.amountOut, output.decimals, output.symbol)}`);

  const consumed = includedAmountIn - quoted.amountInLeft;
  console.log(`consumed  ${amount(consumed, input.decimals, input.symbol)}`);

  if (quoted.amountInLeft > 0n) {
    // The pool ran out of liquidity in range before the whole input was used.
    console.log(`unfilled  ${amount(quoted.amountInLeft, input.decimals, input.symbol)}`);
    console.log("\nthe pool cannot fill this size in range, so the swap example would need partial fill");
  }

  // What the swap example would send as its floor. The SDK never plans a zero minimum.
  for (const bps of [10, 50, 100]) {
    const minimum = minOutFromSlippage(quoted.amountOut, BigInt(bps));
    console.log(`min out @ ${String(bps).padStart(3)} bps  ${amount(minimum, output.decimals, output.symbol)}`);
  }
});
