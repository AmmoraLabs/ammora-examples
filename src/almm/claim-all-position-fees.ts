/** almm:claim-all-position-fees -- <pool> <id,id> [new-progress.json]. Sequential transactions. */
import { almm, natural } from "../shared/actions.js";
import { executeBatch } from "../shared/batch-execution.js";
import { tokenCredit } from "../fees/token-credit.js";
import { main } from "../shared/run.js";
import { printJson } from "../shared/input.js";
main(async () => {
  const c = await almm(process.argv[2]);
  const tokenIds = (process.argv[3] ?? "").split(",").map(id => natural(id, "tokenId"));
  const plan = await c.sdk.planClaimAllPositionFees({ tokenIds, caller: c.caller });
  printJson({ positions: plan.positions, atomic: false, note: "A transaction with zero token credit is not a positive payout" });
  const hashes = await executeBatch(c, plan.transactions, process.argv[4]);
  for (const hash of hashes) for (const token of [c.state.baseToken, c.state.quoteToken]) printJson(await tokenCredit(c.client, hash, token, c.caller));
});
