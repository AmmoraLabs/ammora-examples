/** arl:merge-compounding-positions -- <pool> <destinationPoolNftId> <sourcePoolNftId>. Both owners and locks must match. */
import { arl, natural, execute } from "../shared/actions.js";
import { sameTransaction } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], "compounding"), destinationTokenId = natural(process.argv[3], "destinationPoolNftId"), sourceTokenId = natural(process.argv[4], "sourcePoolNftId");
  const checked = await c.sdk.planMergeCompoundingPositionsForCaller({ destinationTokenId, sourceTokenId, caller: c.caller });
  const transaction = sameTransaction(checked, c.sdk.planMergeCompoundingPositions(destinationTokenId, sourceTokenId));
  await c.client.call({ ...transaction, account: c.caller });
  await execute("merge direct compounding positions", c, transaction);
});
