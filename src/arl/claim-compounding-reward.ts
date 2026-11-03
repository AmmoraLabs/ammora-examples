/** arl:claim-compounding-reward -- <pool> <poolNftId> <slot:0|1> [recipient]. */
import { arl, natural, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { sameTransaction, requirePositiveReward } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], "compounding"), tokenId = natural(process.argv[3], "poolNftId"), index = integer(process.argv[4] ?? "", "reward slot", 0, 1), recipient = address("RECIPIENT", process.argv[5] ?? c.caller);
  const checked = await c.sdk.planClaimCompoundingReward(tokenId, index, recipient, c.caller);
  requirePositiveReward(checked.claimable);
  // The low-level method has no caller check. Compare it only AFTER the checked planner.
  const transaction = sameTransaction(checked.transaction, c.sdk.planClaimPositionReward(tokenId, index, recipient));
  printJson({ rewardToken: checked.rewardToken, claimable: checked.claimable, recipient, payoutVerified: false });
  await execute("claim direct compounding reward", c, transaction);
});
