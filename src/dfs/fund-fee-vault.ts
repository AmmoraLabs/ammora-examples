/** npm run dfs:fund-fee-vault -- <vault> <feeVault>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { dfs } from "./context.js";
import { natural, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await dfs(process.argv[2]);
  const plan = await c.sdk.planAtomicFundingWithPreflight({ kind: "feeVault", source: address("FEE_VAULT", process.argv[3]), caller: c.caller });
  printJson(plan);
  if (!plan.ready || !plan.transaction || plan.setupTransactions.length) throw new Error("Source setup is incomplete; owner must separately review permissions");
  await execute("atomic fee vault funding", c, plan.transaction);
});
