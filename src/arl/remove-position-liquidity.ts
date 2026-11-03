/** npm run arl:remove-position-liquidity -- <pool> <tokenId> <liquidityRaw>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { almm, arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planRemoveManagedConcentratedLiquidity({ tokenId: natural(process.argv[3], "tokenId"), caller: c.caller, liquidity: natural(process.argv[4], "liquidityRaw", true), slippageBps: slippage(), recipient: c.caller, deadline: deadline() });
  await execute("remove-position-liquidity", c, plan.transaction);
});
