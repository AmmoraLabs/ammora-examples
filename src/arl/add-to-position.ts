/** npm run arl:add-to-position -- <pool> <tokenId> <maxBaseRaw> <maxQuoteRaw>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { almm, arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planAddLiquidityToManagedConcentratedPosition({ tokenId: natural(process.argv[3], "tokenId"), caller: c.caller, maximumBaseAmount: natural(process.argv[4], "maxBaseRaw", true), maximumQuoteAmount: natural(process.argv[5], "maxQuoteRaw", true), slippageBps: slippage(), deadline: deadline() });
  await execute("add to managed position", c, plan.transaction, plan.approvalRequirements);
});
