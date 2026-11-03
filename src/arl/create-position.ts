/** arl:create-position -- <pool> <maxBaseRaw> <maxQuoteRaw> [recipient] [deadlineUnix]. Creates a NEW unlocked managed NFT; no existing LP is touched. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  if (process.argv.length < 5 || process.argv.length > 7) throw new Error("usage: <pool> <maxBaseRaw> <maxQuoteRaw> [recipient] [deadlineUnix]");
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planCreateAndAddManagedConcentratedPosition({ maximumBaseAmount: natural(process.argv[3], "maxBaseRaw", true), maximumQuoteAmount: natural(process.argv[4], "maxQuoteRaw", true), slippageBps: slippage(), recipient: process.argv[5] ? address("recipient", process.argv[5]) : c.caller, deadline: process.argv[6] ? natural(process.argv[6], "deadlineUnix", true) : deadline() });
  await execute("create unlocked managed position", c, plan.transaction, plan.approvalRequirements);
});
