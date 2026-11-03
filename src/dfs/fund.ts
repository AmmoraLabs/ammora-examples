/** npm run dfs:fund -- <vault> <maxAmountRaw>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { dfs } from "./context.js";
import { natural, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await dfs(process.argv[2]);
  const plan = await c.sdk.planCappedDirectFundingWithApproval(natural(process.argv[3], "maxAmountRaw", true));
  await execute("capped direct DFS funding", c, plan.transaction, plan.approvalRequirements);
});
