/** arl:remove-compounding-liquidity -- <pool> <tokenId> <liquidityRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], "compounding");
  const plan = await c.sdk.planRemoveLiquidity({ tokenId: natural(process.argv[3], "tokenId"), liquidity: natural(process.argv[4], "liquidityRaw", true), slippageBps: slippage(), caller: c.caller, recipient: c.caller, deadline: deadline() });
  await execute("remove unlocked compounding liquidity", c, plan.transaction);
});
