/** arl:lock-compounding-position -- <pool> <poolNftId> <futureReleasePoint>. Time/block units follow pool activationType. */
import { arl, natural, execute } from "../shared/actions.js";
import { integer } from "../shared/input.js";
import { sameTransaction } from "./optional-guards.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], "compounding"), tokenId = natural(process.argv[3], "poolNftId");
  const parameters = { tokenId, releasePoint: integer(process.argv[4] ?? "", "releasePoint", 1, 2 ** 40 - 1), permanent: false };
  const checked = await c.sdk.planLockCompoundingPositionForCaller({ ...parameters, caller: c.caller });
  const transaction = sameTransaction(checked, c.sdk.planLockCompoundingPosition(parameters));
  await c.client.call({ ...transaction, account: c.caller });
  await execute("time-lock direct compounding position", c, transaction);
});
