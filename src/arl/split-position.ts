/**
 * Split a concentrated position, sending a share of it to another address.
 *
 *   npm run arl:split-position -- <pool> <tokenId> <recipient> <percent>
 *
 * Each part of a position splits separately: unlocked liquidity, permanently locked
 * liquidity, owed fees, rewards, vesting. This example moves the same percentage of every
 * part, which is the common case; pass different numerators to the SDK for anything else.
 */
import { DammV2Client } from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { main, requireContract, send } from "../shared/run.js";

/** The contract reads numerators against this denominator. */
const DENOMINATOR = 1_000_000_000;

main(async () => {
  const [poolArgument, tokenIdArgument, recipientArgument, percentArgument] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArgument);
  const recipient = address("AMMORA_RECIPIENT", recipientArgument);
  if (!tokenIdArgument || !percentArgument) {
    throw new Error("usage: <pool> <tokenId> <recipient> <percent>");
  }
  const tokenId = BigInt(tokenIdArgument);
  const percent = Number(percentArgument);
  if (!(percent > 0 && percent < 100)) {
    throw new Error("percent must be between 0 and 100 exclusive, since a full transfer is just a transfer");
  }
  const numerator = Math.round((percent / 100) * DENOMINATOR);

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.launch;

  await requireContract(client, "pool", pool);
  const sdk = new DammV2Client(
    client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions(),
  );

  console.log(`pool       ${pool}`);
  console.log(`position   ${tokenId}`);
  console.log(`recipient  ${recipient}`);
  console.log(`share      ${percent}% of every part of the position`);
  console.log("");

  await send(
    "splitPosition",
    await sdk.planSplitManagedConcentratedPosition({
      tokenId,
      caller: account.address,
      split: {
        unlockedLiquidityNumerator: numerator,
        permanentLockedLiquidityNumerator: numerator,
        feeBaseNumerator: numerator,
        feeQuoteNumerator: numerator,
        reward0Numerator: numerator,
        reward1Numerator: numerator,
        innerVestingLiquidityNumerator: numerator,
      },
      recipient,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    }),
    wallet,
    account,
    client,
  );
});
