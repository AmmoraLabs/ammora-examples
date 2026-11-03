/** almm:remove-liquidity -- <pool> <managerNftId> <shareBps>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { almm, natural, deadline, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await almm(process.argv[2]);
  const plan = await c.sdk.planRemovePositionLiquidity({ tokenId: natural(process.argv[3], "tokenId"), shareBps: integer(process.argv[4] ?? "", "shareBps", 1, 10000), caller: c.caller, recipient: c.caller, deadline: deadline() });
  await execute("remove ALMM liquidity", c, plan.transactions);
});
