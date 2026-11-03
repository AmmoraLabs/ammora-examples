/** npm run staking:withdraw-unstake-v2 -- <vault> <requestId>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { buildWithdrawAStakeV2Unstake } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildWithdrawAStakeV2Unstake(natural(process.argv[3], "requestId", false)) };
  await execute("withdraw-unstake v2", c, transaction);
});
