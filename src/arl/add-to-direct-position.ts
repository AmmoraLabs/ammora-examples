/** arl:add-to-direct-position -- <pool> <kind> <poolNftId> <maximumBaseRaw> <maximumQuoteRaw>. Not a managed NFT ID. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { slippage, printJson } from "../shared/input.js";
import { poolKind } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], poolKind(process.argv[3]));
  const plan = await c.sdk.planAddLiquidityToPosition({ tokenId: natural(process.argv[4], "poolNftId"), caller: c.caller, maximumBaseAmount: natural(process.argv[5], "maximumBaseRaw", true), maximumQuoteAmount: natural(process.argv[6], "maximumQuoteRaw", true), slippageBps: slippage(), deadline: deadline() });
  printJson({ collection: c.pool, quote: plan.quote });
  await execute("add to direct pool position", c, plan.transaction, plan.approvalRequirements);
});
