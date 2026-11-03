/** arl:claim-compounding-fees -- <pool> <tokenId>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2], "compounding");
  const plan = await c.sdk.planClaimCompoundingFees(natural(process.argv[3], "tokenId"), c.caller, c.caller);
  await execute("claim compounding fees", c, plan);
});
