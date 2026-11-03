/** fees:delegate -- <feeVault> <delegate> <allow|revoke>. Beneficiary signs; does not change LP permissions. */
import { buildSetFeeVaultClaimDelegate } from "@ammora-protocol/sdk";
import { feeVaultContext } from "./context.js";
import { nonzero } from "./policy.js";
import { execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
import { printJson } from "../shared/input.js";
main(async () => {
  const [vault, delegateArg, mode, ...extra] = process.argv.slice(2);
  if (extra.length || !["allow", "revoke"].includes(mode ?? "")) throw new Error("usage: <feeVault> <delegate> <allow|revoke>");
  const c = await feeVaultContext(vault), delegate = nonzero(delegateArg, "delegate");
  if (delegate.toLowerCase() === c.caller.toLowerCase()) throw new Error("Delegate must differ from beneficiary");
  const before = await c.client.readContract({ address: c.vault, abi: c.abi, functionName: "claimDelegate", args: [c.caller, delegate] });
  printJson({ beneficiary: c.caller, delegate, before, allowed: mode === "allow", warning: "Delegate may redirect ALL this beneficiary's fee assets in this vault" });
  if (before === (mode === "allow")) return;
  await execute("set beneficiary FeeVault delegate", c, { to: c.vault, ...buildSetFeeVaultClaimDelegate(delegate, mode === "allow") });
});
