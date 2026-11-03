import { tokenAmount, slippage } from "../shared/input.js";
/**
 * Swap on a bin (ALMM) pool.
 *
 *   npm run almm:swap -- <poolAddress> <amountIn> [base-for-quote]
 *
 * Quote first with `almm:quote-swap`. This sends the same trade with a slippage floor.
 */
import { ALMMClient } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, approve, asPool, main, requireContract, send, tokenInfo } from "../shared/run.js";

/** Conservative default; override with AMMORA_SLIPPAGE_BPS. */
const slippageBps = slippage();

main(async () => {
  const [poolArgument, amountArgument, directionArgument] = process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (!amountArgument) {
    throw new Error("pass an input amount: npm run almm:swap -- <pool> <amountIn> [base-for-quote]");
  }
  const baseForQuote = directionArgument === "base-for-quote";

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "pool", pool);
  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());

  // Read the pair first so the amount can be scaled by the input token's own decimals.
  const state = await asPool(pool, "a bin pool", () => sdk.getPoolState());
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);
  const input = baseForQuote ? base : quote;
  const output = baseForQuote ? quote : base;
  const includedAmountIn = tokenAmount(amountArgument, input.decimals);

  // Planning both prices the trade and states which approval it needs. The pool's
  // provenance is proved here, before any approval is prepared, so a contract that is
  // not a pool from the reviewed factory is refused with a message that says so.
  const plan = await sdk.planSwapExactInput({
    includedAmountIn,
    baseForQuote,
    allowPartialFill: true,
    slippageBps,
    recipient: account.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  });

  console.log(`pool   ${pool}`);
  console.log(`in     ${amount(includedAmountIn, input.decimals, input.symbol)}`);
  console.log(`out    ${amount(plan.quote.amountOut, output.decimals, output.symbol)} (quoted)`);
  console.log(`floor  ${slippageBps} bps slippage`);
  console.log("");

  await approve(plan.approvalRequirements, wallet, account, client);
  await send("swap", plan.transaction, wallet, account, client);
});
