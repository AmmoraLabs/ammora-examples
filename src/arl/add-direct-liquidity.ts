/** arl:add-direct-liquidity -- <pool> <kind> <maximumBaseRaw> <maximumQuoteRaw> [deadlineUnix]. New unlocked pool NFT, separate from managed positions. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { poolKind } from "./optional-guards.js";
import { slippage, printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], poolKind(process.argv[3]));
  const plan = await c.sdk.planAddLiquidity({ maximumBaseAmount: natural(process.argv[4], "maximumBaseRaw", true), maximumQuoteAmount: natural(process.argv[5], "maximumQuoteRaw", true), slippageBps: slippage(), recipient: c.caller, deadline: process.argv[6] ? natural(process.argv[6], "deadlineUnix", true) : deadline(), lockDuration: 0, permanentLock: false });
  printJson({ quote: plan.quote, collection: c.pool, tokenId: "Resolve LiquidityAdded from the canonical receipt" });
  await execute("add unlocked direct pool liquidity", c, plan.transaction, plan.approvalRequirements);
});
