/**
 * Read a bin pool's active bin, the one trading happens in. No key required.
 *
 *   npm run almm:active-bin -- <poolAddress>
 *
 * The reference repository splits this across `active-id` and `get-active-bin`; the id and
 * the bin's contents are one read here, so this covers both.
 */
import { almmBinPoolAbi, ALMMClient } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader } from "../shared/env.js";
import { amount, asPool, main, requireContract, tokenInfo } from "../shared/run.js";

main(async () => {
  const pool = address("ALMM_POOL", process.argv[2]);
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;

  await requireContract(client, "pool", pool);
  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());
  const state = await asPool(pool, "a bin pool", () => sdk.getPoolState());
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);

  console.log(`pool       ${pool}`);
  console.log(`pair       ${base.symbol} / ${quote.symbol}`);
  console.log(`bin step   ${state.binStepBps} bps`);
  console.log(`active id  ${state.activeId}`);
  console.log(`fee now    ${state.currentFeeBps} bps`);
  console.log(`status     ${state.status}`);

  const bin = await client.readContract({
    abi: almmBinPoolAbi,
    address: pool,
    functionName: "bins",
    args: [state.activeId],
  }) as readonly [bigint, bigint, bigint, bigint, ...unknown[]];
  // Bin is (reserveBase, reserveQuote, liquidity, totalShares, ...), so skip liquidity.
  const [reserveBase, reserveQuote, , totalShares] = bin;

  console.log("");
  console.log("active bin reserves");
  console.log(`  base   ${amount(reserveBase, base.decimals, base.symbol)}`);
  console.log(`  quote  ${amount(reserveQuote, quote.decimals, quote.symbol)}`);
  console.log(`  shares ${totalShares}`);

  if (reserveBase === 0n && reserveQuote === 0n) {
    // A swap starting here would traverse outward before it filled anything.
    console.log("\nthe active bin is empty, so a swap would cross into neighbouring bins");
  }
});
