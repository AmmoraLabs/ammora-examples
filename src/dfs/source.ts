/** dfs:source -- <vault> <source.json> <allow|revoke>. Vault owner only; separate from source-side permission. */
import { dfs } from "./context.js";
import { sourcePolicy } from "./source-policy.js";
import { authenticateSource } from "./source-context.js";
import { document } from "../fees/policy.js";
import { execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
import { printJson } from "../shared/input.js";
main(async () => {
  const c = await dfs(process.argv[2]), p = sourcePolicy(document(process.argv[3])), mode = process.argv[4];
  if (process.argv.length !== 5 || !["allow", "revoke"].includes(mode ?? "")) throw new Error("usage: <vault> <source.json> <allow|revoke>");
  if (mode === "allow") await authenticateSource(p);
  const transaction = await c.sdk.planSetClaimSource({ source: p.source, allowed: mode === "allow", caller: c.caller });
  printJson({ vault: c.vault, source: p.source, allowed: mode === "allow", note: "This does not grant beneficiary/NFT permission" });
  await execute("set DFS claim source", c, transaction);
});
