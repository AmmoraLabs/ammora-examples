import { tokenAmount } from "../shared/input.js";
/**
 * Add liquidity to a bin position you already hold, weighted across its bins.
 *
 *   npm run almm:add-liquidity -- <pool> <tokenId> <baseAmount> <quoteAmount>
 *
 * Weights decide how the deposit is spread. This puts an equal weight on every bin the
 * position already covers, which keeps its existing shape; pass your own weights to the
 * SDK to change it.
 */
import { ALMMClient } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { aboutPosition, amount, approve, asPool, main, requireContract, send, tokenInfo } from "../shared/run.js";

main(async () => {
  const [poolArgument, tokenIdArgument, baseArgument, quoteArgument] = process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (!tokenIdArgument || !baseArgument || !quoteArgument) {
    throw new Error("usage: <pool> <tokenId> <baseAmount> <quoteAmount>");
  }
  const tokenId = BigInt(tokenIdArgument);

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;

  await requireContract(client, "pool", pool);
  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());
  const state = await asPool(pool, "a bin pool", () => sdk.getPoolState());
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);

  const totalBaseAmount = tokenAmount(baseArgument, base.decimals, true);
  const totalQuoteAmount = tokenAmount(quoteArgument, quote.decimals, true);

  // The bins this position already covers; adding to those keeps its shape.
  const context = await aboutPosition(tokenId, () => sdk.getPositionContext(tokenId, account.address));
  const binIds: number[] = [];
  for (let binId = context.lowerBinId; binId <= context.upperBinId; binId += 1) {
    binIds.push(binId);
  }
  if (binIds.length === 0) throw new Error(`position ${tokenId} covers no bins`);
  if (binIds.length > 64) {
    // The contract caps a weighted deposit at 64 bins per call.
    throw new Error(`position spans ${binIds.length} bins, so add to them in chunks of 64`);
  }

  console.log(`pool     ${pool}`);
  console.log(`position ${tokenId} across ${binIds.length} bin(s)`);
  console.log(`adding   ${amount(totalBaseAmount, base.decimals, base.symbol)}`);
  console.log(`         ${amount(totalQuoteAmount, quote.decimals, quote.symbol)}`);
  console.log("");

  const plan = await sdk.planAddLiquidityByWeight({
    tokenId,
    caller: account.address,
    totalBaseAmount,
    totalQuoteAmount,
    weights: binIds.map((binId) => ({ binId, baseWeight: 1n, quoteWeight: 1n })),
    shareSlippageBps: 100,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  });

  await approve(plan.approvalRequirements, wallet, account, client);
  await send("addLiquidityByWeight", plan.transaction, wallet, account, client);
});
