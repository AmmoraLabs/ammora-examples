/** arl:merge-positions -- <pool> <destinationNftId> <sourceNftId>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planMergeManagedConcentratedPositionsQuoted({ destinationTokenId: natural(process.argv[3], "destinationNftId"), sourceTokenId: natural(process.argv[4], "sourceNftId"), caller: c.caller, slippageBps: slippage(), deadline: deadline() });
  await execute("merge managed concentrated positions", c, plan.transaction);
});
