/** arl:refresh-vesting -- <pool> <managerNftId>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { arl, natural, deadline, execute } from "../shared/actions.js";
import { slippage } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await arl(process.argv[2]);
  const plan = await c.sdk.planRefreshManagedConcentratedVesting(natural(process.argv[3], "managerNftId"));
  await execute("refresh released vesting liquidity", c, plan);
});
