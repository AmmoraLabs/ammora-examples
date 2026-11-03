import { tokenAmount } from "../shared/input.js";
/**
 * Top a concentrated position up, then lock what was added.
 *
 *   npm run arl:add-liquidity-and-lock -- <pool> <tokenId> <baseAmount> <quoteAmount>
 *
 * Two transactions, so between them the added liquidity is briefly withdrawable. The
 * position is yours, so that window only matters if you are proving the commitment to
 * someone else. For a first position, createProductionPoolLocked does both at once.
 */
import { DammV2Client } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, approve, asPool, main, requireContract, send, tokenInfo } from "../shared/run.js";

main(async () => {
  const [poolArgument, tokenIdArgument, baseArgument, quoteArgument] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArgument);
  if (!tokenIdArgument || !baseArgument || !quoteArgument) {
    throw new Error("usage: <pool> <tokenId> <baseAmount> <quoteAmount>");
  }
  const tokenId = BigInt(tokenIdArgument);

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.launch;

  await requireContract(client, "pool", pool);
  const sdk = new DammV2Client(
    client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions(),
  );
  const state = await asPool(pool, "a concentrated pool", () => sdk.getPoolState());
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);

  const maximumBaseAmount = tokenAmount(baseArgument, base.decimals, true);
  const maximumQuoteAmount = tokenAmount(quoteArgument, quote.decimals, true);

  const before = await sdk.getManagedConcentratedPosition(tokenId) as { unlockedLiquidity: bigint };
  console.log(`pool     ${pool}`);
  console.log(`position ${tokenId}`);
  console.log(`adding   up to ${amount(maximumBaseAmount, base.decimals, base.symbol)}`);
  console.log(`         up to ${amount(maximumQuoteAmount, quote.decimals, quote.symbol)}`);
  console.log("");

  const plan = await sdk.planAddLiquidityToManagedConcentratedPosition({
    tokenId,
    caller: account.address,
    maximumBaseAmount,
    maximumQuoteAmount,
    slippageBps: 100,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
  });
  await approve(plan.approvalRequirements, wallet, account, client);
  await send("addLiquidity", plan.transaction, wallet, account, client);

  // Lock exactly what this run added, leaving anything unlocked beforehand as it was.
  const after = await sdk.getManagedConcentratedPosition(tokenId) as { unlockedLiquidity: bigint };
  const added = after.unlockedLiquidity - before.unlockedLiquidity;
  console.log(`\nadded ${added} of unlocked liquidity`);

  if (added <= 0n) {
    console.log("nothing was added, so there is nothing to lock");
    return;
  }
  await send(
    "permanentLockPosition",
    await sdk.planPermanentLockManagedConcentratedPosition(tokenId, added, account.address),
    wallet,
    account,
    client,
  );
});
