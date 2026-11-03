import { tokenAmount } from "../shared/input.js";
/**
 * Pay liquidity providers to keep depth in a pool, in a token you choose.
 *
 *   npm run almm:create-reward -- <pool> <rewardToken> <amount> [days]
 *
 * The problem this solves shows up right after a launch graduates. The pool exists, but
 * the only depth is whatever the launch put there, and nobody else has a reason to add
 * more into a price that has just started moving. A reward campaign gives them one: for
 * as long as it runs, every position in the pool earns the reward token in proportion
 * to the liquidity it holds and how long it holds it.
 *
 * That is liquidity mining, and it is not staking. Nobody locks anything and nobody
 * gives up custody. A position that is already providing liquidity simply also accrues
 * rewards, and stops accruing them when it leaves.
 *
 * ── Two calls, and why they are separate ──────────────────────────────────────
 * `initializeReward` declares the campaign: which token, who may fund it, and
 * over how long each funding is paid out. `fundReward` puts tokens in. Declaring
 * costs nothing and can be done before the money is ready, and funding can be
 * repeated to extend a campaign that is running dry.
 *
 * `carryForward` decides what happens to a top-up that arrives while the previous
 * one is still paying out. True adds the remainder to the new period rather than
 * letting it lapse, which is what you want unless you are deliberately resetting.
 *
 * ── Who may do this ───────────────────────────────────────────────────────────
 * Only the reward manager's owner may declare a campaign, which is governance,
 * not the pool's creator. Funding is open to the funder that the campaign names.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import {
  ALMMClient,
  almmRewardManagerAbi,
  buildFundALMMReward,
  buildInitializeALMMReward,
} from "@ammora-protocol/sdk";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import {
  amount,
  approve,
  asPool,
  main,
  preflight,
  readAtBlockWithRetry,
  requireContract,
  send,
  tokenInfo,
} from "../shared/run.js";

/** Reward slot on the pool. A pool can run two campaigns at once. */
const REWARD_INDEX = 0;

const DEFAULT_DAYS = 7;

main(async () => {
  const [poolArgument, tokenArgument, amountArgument, daysArgument] = process.argv.slice(2);
  const pool = address("ALMM_POOL", poolArgument);
  if (!tokenArgument || !amountArgument) {
    throw new Error("usage: npm run almm:create-reward -- <pool> <rewardToken> <amount> [days]");
  }
  const rewardToken = address("AMMORA_REWARD_TOKEN", tokenArgument);
  const days = Number(daysArgument ?? DEFAULT_DAYS);
  if (!Number.isInteger(days) || days <= 0) throw new Error("days must be a whole number above 0");
  const duration = days * 24 * 60 * 60;

  const { wallet, account } = signer();
  const client = await reader();
  const contracts = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "pool", pool);
  await requireContract(client, "reward manager", contracts.rewardManager);
  await requireContract(client, "reward token", rewardToken);

  const sdk = new ALMMClient(client, pool, contracts.positionManager, contracts.binLens, clientOptions());
  await asPool(pool, "a bin pool", () => sdk.getPoolState());

  const reward = await tokenInfo(client, rewardToken);
  const fundAmount = tokenAmount(amountArgument, reward.decimals);

  // A slot that already names a token has been declared before. Declaring it again would
  // revert, and the campaign it already has is the one to fund.
  const snapshotBlock = await client.getBlockNumber();
  const [existing, snapshot] = await Promise.all([
    readAtBlockWithRetry(snapshotBlock, () => client.readContract({
    abi: almmRewardManagerAbi, address: contracts.rewardManager,
    functionName: "getRewardInfo", args: [pool, REWARD_INDEX],
      blockNumber: snapshotBlock,
    })),
    readAtBlockWithRetry(snapshotBlock, () => client.getBlock({ blockNumber: snapshotBlock })),
  ]) as [{
    token: Address;
    funder: Address;
    duration: bigint | number;
    periodEnd: bigint | number;
    rewardRate: bigint;
  }, { timestamp: bigint }];
  const declared = existing.token !== "0x0000000000000000000000000000000000000000";

  // The manager pays an integer number of raw token units per second. Funding less than
  // one raw unit per second makes rewardRate zero and the contract rejects it. Explain
  // that before declaring a campaign, otherwise the user pays for a declaration whose
  // first funding transaction cannot succeed at the chosen amount.
  const now = snapshot.timestamp;
  const periodEnd = BigInt(existing.periodEnd);
  const remaining = declared && now < periodEnd
    ? (periodEnd - now) * existing.rewardRate
    : 0n;
  if ((remaining + fundAmount) / BigInt(duration) === 0n) {
    throw new Error(
      `reward amount is too small for ${duration} seconds: fund at least one raw `
      + `${reward.symbol} unit per second (or shorten the campaign)`,
    );
  }

  console.log(`pool       ${pool}`);
  console.log(`reward     ${amount(fundAmount, reward.decimals, reward.symbol)}`);
  console.log(`slot       ${REWARD_INDEX}${declared ? " (already declared)" : " (new)"}`);
  console.log(`paid over  ${days} day(s)`);
  console.log("");

  if (!declared) {
    const declare = {
      to: contracts.rewardManager,
      ...buildInitializeALMMReward(pool, REWARD_INDEX, rewardToken, account.address, duration),
    };
    await preflight(client, account, declare, almmRewardManagerAbi, "declare reward");
    await send("declare reward", declare, wallet, account, client);
  } else if (existing.token.toLowerCase() !== rewardToken.toLowerCase()) {
    throw new Error(
      `slot ${REWARD_INDEX} already pays ${existing.token}. A slot's token is fixed once declared`,
    );
  }

  const fund = {
    to: contracts.rewardManager,
    // Carry the unpaid remainder of any running period into this one instead of
    // dropping it.
    ...buildFundALMMReward(pool, REWARD_INDEX, fundAmount, true),
  };

  await approve(
    [{ token: rewardToken, spender: contracts.rewardManager, amount: fundAmount }],
    wallet,
    account,
    client,
  );
  await preflight(client, account, fund, almmRewardManagerAbi, "fund reward");
  await send("fund reward", fund, wallet, account, client);
});
