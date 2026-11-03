/** npm run staking:request-unstake-v2 -- <vault> <amountRaw>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { buildRequestAStakeV2Unstake } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const transaction = { to: c.target, ...buildRequestAStakeV2Unstake(natural(process.argv[3], "amountRaw", true)) };
  await execute("request-unstake v2", c, transaction);
});
