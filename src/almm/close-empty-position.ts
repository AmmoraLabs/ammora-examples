/** almm:close-empty-position -- <pool> <managerNftId>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { almm, natural, deadline, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await almm(process.argv[2]);
  const plan = await c.sdk.planCloseEmptyPosition({ tokenId: natural(process.argv[3], "tokenId"), caller: c.caller });
  await execute("close empty ALMM NFT", c, plan.transaction);
});
