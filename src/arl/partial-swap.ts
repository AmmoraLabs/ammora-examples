/** arl:partial-swap -- <pool> <tokenIn> <maximumInputRaw>. Explicit partial-fill opt-in. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { printJson, slippage } from "../shared/input.js";
import { partialAccounting } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]), tokenIn = address("TOKEN_IN", process.argv[3]), maximumAmountIn = natural(process.argv[4], "maximumInputRaw", true);
  // A read-only quote for UI display. Execution uses the planner's fresh quote below.
  printJson({ preview: partialAccounting(maximumAmountIn, await c.sdk.quotePartialExactInput(tokenIn, maximumAmountIn)) });
  const plan = await c.sdk.planPartialExactInput({ tokenIn, maximumAmountIn, recipient: c.caller, slippageBps: slippage(), deadline: deadline() });
  printJson({ planned: partialAccounting(maximumAmountIn, plan.quote), minimumOutput: plan.quote.minimumAmountOut, balanceReconciled: false });
  await execute("explicit partial concentrated swap", c, plan.transaction, plan.approvalRequirements);
});
