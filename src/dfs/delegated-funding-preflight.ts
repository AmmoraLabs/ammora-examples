/** npm run dfs:delegated-funding-preflight -- <vault> <feeVault> <beneficiary>. Default: unsigned preview; see docs/CONTRACT-FEATURES.md. */
import { dfs } from "./context.js";
import { natural, execute } from "../shared/actions.js";
import { address } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
main(async () => {
  const c = await dfs(process.argv[2]);
  const plan = await c.sdk.preflightDelegatedFeeVaultFunding({ source: address("FEE_VAULT", process.argv[3]), beneficiary: address("BENEFICIARY", process.argv[4]), caller: c.caller });
  printJson({ ...plan, automaticSetup: false, note: "Review expectedSetupSender; this command never sends owner permission changes" });
});
