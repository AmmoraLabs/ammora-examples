/** dfs:fund-source -- <vault> <source.json>. Preflight reports setup; never automatically grants it. */
import { dfs } from "./context.js";
import { sourcePolicy } from "./source-policy.js";
import { authenticateSource } from "./source-context.js";
import { document } from "../fees/policy.js";
import { tokenCredit } from "../fees/token-credit.js";
import { execute, validateAction } from "../shared/actions.js";
import { signer } from "../shared/env.js";
import { main, send } from "../shared/run.js";
import { printJson } from "../shared/input.js";
main(async () => {
  const c = await dfs(process.argv[2]), p = sourcePolicy(document(process.argv[3]));
  if (process.argv.length !== 4) throw new Error("usage: <vault> <source.json>");
  await authenticateSource(p);
  const before = await c.sdk.getState();
  const plan = await c.sdk.planAtomicFundingWithPreflight({ ...p, caller: c.caller });
  printJson({ ...plan, automaticSetup: false, sourceKind: p.kind, token: before.token });
  if (!plan.ready || !plan.transaction || plan.setupTransactions.length) throw new Error("Source setup incomplete; each owner/beneficiary must separately review and send its permission");
  if (process.env.AMMORA_SEND !== "1") return execute("fund DFS from authenticated source", c, plan.transaction);
  validateAction(plan.transaction, c.allowedTargets);
  const { wallet, account } = signer();
  if (account.address.toLowerCase() !== c.caller.toLowerCase()) throw new Error("Caller/signer mismatch");
  const hash = await send("fund DFS from authenticated source", plan.transaction, wallet, account, c.client);
  const credit = await tokenCredit(c.client, hash, before.token, c.vault);
  if (!credit.payoutVerified || credit.amount === 0n) throw new Error(`No positive source funding in ${hash}; do not resend`);
  const after = await c.sdk.getState();
  printJson({ credit, totalFundedBefore: before.totalFunded, totalFundedAfter: after.totalFunded,
    note: "Vault funding is not a recipient payout; recipients separately call dfs:claim" });
});
