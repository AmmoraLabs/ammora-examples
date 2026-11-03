/** arl:claim-position-reward -- <pool> <managerNftId> <rewardIndex>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { ammConcentratedPositionManagerV3Abi } from "@ammora-protocol/sdk";
import { readBlock } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const tokenId = natural(process.argv[3], "managerNftId"), index = integer(process.argv[4] ?? "", "reward index", 0, 1);
  const plan = await c.sdk.planClaimManagedConcentratedReward(tokenId, index, c.caller, c.caller);
  const block = await readBlock(c.client);
  const simulation = await c.client.simulateContract({ address: plan.to, abi: ammConcentratedPositionManagerV3Abi,
    functionName: "claimPositionReward", args: [tokenId, index, c.caller], account: c.caller, blockNumber: block.number });
  if (simulation.result <= 0n) throw new Error("No positive managed position reward is claimable; a funded reward program and eligible accrued liquidity are required");
  printJson({ tokenId, index, recipient: c.caller, expectedAmountRaw: simulation.result, blockNumber: block.number, payoutVerified: false });
  await execute("claim managed position reward", c, plan);
});
