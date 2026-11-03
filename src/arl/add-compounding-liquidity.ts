/** arl:add-compounding-liquidity -- <pool> <maximumBaseRaw> <maximumQuoteRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], "compounding");
  const plan = await c.sdk.planAddLiquidity({ maximumBaseAmount: natural(process.argv[3], "maximumBaseRaw", true), maximumQuoteAmount: natural(process.argv[4], "maximumQuoteRaw", true), slippageBps: slippage(), recipient: c.caller, deadline: deadline() });
  await execute("add compounding liquidity", c, plan.transaction, plan.approvalRequirements);
});
