/**
 * Permanently lock liquidity in a concentrated position.
 *
 *   npm run arl:lock-position -- <pool> <tokenId> [liquidity]
 *
 * Locking is one-way. Without a liquidity argument this locks everything still unlocked,
 * which is what a creator proving their liquidity is committed usually wants.
 *
 * If you are creating the pool as well, the factory's createProductionPoolLocked seals the
 * first position in the creating call, so there is no window where it is unlocked at all.
 */
import { DammV2Client } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { aboutPosition, main, requireContract, send } from "../shared/run.js";

main(async () => {
  const [poolArgument, tokenIdArgument, liquidityArgument] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArgument);
  if (!tokenIdArgument || !/^\d+$/.test(tokenIdArgument)) {
    throw new Error("usage: <pool> <tokenId> [liquidity]");
  }
  const tokenId = BigInt(tokenIdArgument);

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.launch;

  await requireContract(client, "pool", pool);
  const sdk = new DammV2Client(
    client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions(),
  );

  const position = await aboutPosition(tokenId, () => sdk.getManagedConcentratedPosition(tokenId)) as {
    unlockedLiquidity: bigint;
    permanentLockedLiquidity: bigint;
  };
  const liquidity = liquidityArgument ? BigInt(liquidityArgument) : position.unlockedLiquidity;

  console.log(`pool              ${pool}`);
  console.log(`position          ${tokenId}`);
  console.log(`unlocked          ${position.unlockedLiquidity}`);
  console.log(`already locked    ${position.permanentLockedLiquidity}`);
  console.log(`locking           ${liquidity}`);

  if (liquidity === 0n) {
    console.log("\nnothing unlocked to lock, no transaction sent");
    return;
  }
  if (liquidity > position.unlockedLiquidity) {
    throw new Error(`only ${position.unlockedLiquidity} is unlocked`);
  }

  console.log("\nthis cannot be undone");
  await send(
    "permanentLockPosition",
    await sdk.planPermanentLockManagedConcentratedPosition(tokenId, liquidity, account.address),
    wallet,
    account,
    client,
  );
});
