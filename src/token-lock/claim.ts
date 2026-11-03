/** token-lock:claim -- <lock> <maximumAmountRaw>; default unsigned preview, AMMORA_ACCOUNT is required. */
import { ammoraTokenLockAbi, buildClaimAmmoraTokenLock } from "@ammora-protocol/sdk";
import { pinned, natural, execute } from "../shared/actions.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { expectedTokenLockClaim } from "./preflight.js";
main(async () => {
  const c = await pinned(process.argv[2]);
  const maximum = natural(process.argv[3], "maximumAmountRaw", true);
  const read = { address: c.target, abi: ammoraTokenLockAbi, blockNumber: c.blockNumber } as const;
  const [recipient, token, claimable] = await Promise.all([
    c.client.readContract({ ...read, functionName: "recipient" }),
    c.client.readContract({ ...read, functionName: "token" }),
    c.client.readContract({ ...read, functionName: "claimable" }),
  ]);
  const expectedAmountRaw = expectedTokenLockClaim(c.caller, recipient, claimable, maximum);
  printJson({ recipient, token, expectedAmountRaw, blockNumber: c.blockNumber, payoutVerified: false });
  const transaction = { to: c.target, ...buildClaimAmmoraTokenLock(maximum) };
  await execute("claim", c, transaction);
});
