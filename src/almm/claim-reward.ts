/**
 * Collect what a position has earned from a pool's reward campaign.
 *
 *   npm run almm:claim-reward -- <tokenId> [slot]
 *
 * The other side of `almm:create-reward`. Rewards accrue to a position for as long as it
 * holds liquidity while a campaign runs, and this collects them without touching the
 * liquidity itself. The position stays exactly as it was and keeps earning.
 *
 * ── Read before sending ───────────────────────────────────────────────────────
 * `previewPositionReward` reports what the position would be paid right now. It
 * is worth asking, because a position that joined after a campaign ended, or that
 * has already claimed, has earned nothing, and claiming nothing still costs gas.
 *
 * A pool can run two campaigns at once, in slots 0 and 1, paying different
 * tokens. They accrue independently and are claimed independently, so a position
 * in a pool running both has two claims to make.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import {
  almmPositionManagerAbi,
  almmRewardManagerAbi,
  buildClaimALMMPositionReward,
} from "@ammora-protocol/sdk";
import { deployment, reader, signer } from "../shared/env.js";
import { amount, main, positionOwner, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

main(async () => {
  const [tokenArgument, slotArgument] = process.argv.slice(2);
  if (!tokenArgument || !/^\d+$/.test(tokenArgument)) {
    throw new Error("usage: npm run almm:claim-reward -- <tokenId> [slot]");
  }
  const tokenId = BigInt(tokenArgument);
  const slot = Number(slotArgument ?? 0);
  if (slot !== 0 && slot !== 1) throw new Error("slot is 0 or 1");

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "reward manager", contracts.rewardManager);

  const owner = await positionOwner(
    client, almmPositionManagerAbi, contracts.positionManager, tokenId,
  );
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`position ${tokenId} belongs to ${owner}, not to you`);
  }

  const [pool] = await client.readContract({
    abi: almmPositionManagerAbi, address: contracts.positionManager,
    functionName: "positions", args: [tokenId],
  }) as readonly [Address, number, number];

  const campaign = await client.readContract({
    abi: almmRewardManagerAbi, address: contracts.rewardManager,
    functionName: "getRewardInfo", args: [pool, slot],
  }) as { token: Address };
  if (campaign.token === "0x0000000000000000000000000000000000000000") {
    console.log(`pool ${pool} runs no campaign in slot ${slot}`);
    return;
  }

  const reward = await tokenInfo(client, campaign.token);
  const owed = await client.readContract({
    abi: almmRewardManagerAbi, address: contracts.rewardManager,
    functionName: "previewPositionReward", args: [tokenId, slot],
  }) as bigint;

  console.log(`position   ${tokenId}`);
  console.log(`pool       ${pool}`);
  console.log(`slot       ${slot} pays ${reward.symbol}`);
  console.log(`owed       ${amount(owed, reward.decimals, reward.symbol)}`);
  console.log("");

  if (owed === 0n) {
    console.log("nothing to claim, no transaction sent");
    return;
  }

  const claim = {
    to: contracts.rewardManager,
    ...buildClaimALMMPositionReward(tokenId, slot, account.address),
  };
  await preflight(client, account, claim, almmRewardManagerAbi, "claim reward");
  await send("claim reward", claim, wallet, account, client);
});
