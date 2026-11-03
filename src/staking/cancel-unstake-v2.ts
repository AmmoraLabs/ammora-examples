/** npm run staking:cancel-unstake-v2 -- <vault> <requestId>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { buildCancelAStakeV2Unstake } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildCancelAStakeV2Unstake(natural(process.argv[3], "requestId", false)) };
  await execute("cancel-unstake v2", c, transaction);
});
