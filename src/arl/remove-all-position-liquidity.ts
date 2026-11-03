/** npm run arl:remove-all-position-liquidity -- <pool> <tokenId>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { almm, arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planRemoveAllManagedConcentratedLiquidityQuoted({ tokenId: natural(process.argv[3], "tokenId"), caller: c.caller, slippageBps: slippage(), recipient: c.caller, deadline: deadline() });
  await execute("remove-all-position-liquidity", c, plan.transaction);
});
