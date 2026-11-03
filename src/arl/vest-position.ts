/** arl:vest-position -- <pool> <managerNftId> <cliffPoint> <periodFrequency> <numberOfPeriod> <cliffLiquidity> <liquidityPerPeriod>. Default unsigned preview. */
import { arl, natural, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  if (process.argv.length !== 9) throw new Error("usage: <pool> <managerNftId> <cliffPoint> <periodFrequency> <numberOfPeriod> <cliffLiquidity> <liquidityPerPeriod>");
  const c = await arl(process.argv[2]);
  const periods = natural(process.argv[6], "numberOfPeriod");
  if (periods > 65535n) throw new Error("numberOfPeriod exceeds uint16");
  const transaction = await c.sdk.planLockManagedConcentratedVesting({ tokenId: natural(process.argv[3], "managerNftId"), caller: c.caller, cliffPoint: natural(process.argv[4], "cliffPoint"), periodFrequency: natural(process.argv[5], "periodFrequency"), numberOfPeriod: Number(periods), cliffUnlockLiquidity: natural(process.argv[7], "cliffLiquidity"), liquidityPerPeriod: natural(process.argv[8], "liquidityPerPeriod") });
  await execute("lock time-vesting position", c, transaction);
});
