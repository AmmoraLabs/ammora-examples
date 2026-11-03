/** staking:withdraw-unstake -- <vault> <requestId>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { buildWithdrawAStakeUnstake } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildWithdrawAStakeUnstake(natural(process.argv[3], "requestId")) };
  // Contract phase/ownership/lock conditions are checked by the exact simulation on send.
  await execute("withdraw-unstake", c, transaction);
});
