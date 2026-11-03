/** npm run arl:swap-exact-output -- <pool> <amountOutRaw> <tokenOut>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { almm, arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planSwapExactOutput({ amountOut: natural(process.argv[3], "amountOutRaw", true), tokenOut: address("TOKEN_OUT", process.argv[4]), slippageBps: slippage(), recipient: c.caller, deadline: deadline() });
  await execute("swap exact output", c, plan.transaction, plan.approvalRequirements);
});
