/** npm run almm:swap-exact-output -- <pool> <amountOutRaw> <sell-base|sell-quote>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { almm, arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  if (!["sell-base", "sell-quote"].includes(process.argv[4] ?? "")) throw new Error("direction must be sell-base or sell-quote");
  const c = await almm(process.argv[2]);
  const plan = await c.sdk.planSwapExactOutput({ excludedAmountOut: natural(process.argv[3], "amountOutRaw", true), baseForQuote: process.argv[4] === "sell-base", slippageBps: slippage(), recipient: c.caller, deadline: deadline() });
  await execute("swap exact output", c, plan.transaction, plan.approvalRequirements);
});
