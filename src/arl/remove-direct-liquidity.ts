/** arl:remove-direct-liquidity -- <pool> <kind> <poolNftId> <liquidityRaw> [deadlineUnix]. Does not unlock or unwrap managed positions. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { poolKind } from "./optional-guards.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], poolKind(process.argv[3]));
  const plan = await c.sdk.planRemoveLiquidity({ tokenId: natural(process.argv[4], "poolNftId"), liquidity: natural(process.argv[5], "liquidityRaw", true), caller: c.caller, recipient: c.caller, slippageBps: slippage(), deadline: process.argv[6] ? natural(process.argv[6], "deadlineUnix", true) : deadline() });
  await c.client.call({ ...plan.transaction, account: c.caller });
  await execute("remove unlocked direct pool liquidity", c, plan.transaction);
});
