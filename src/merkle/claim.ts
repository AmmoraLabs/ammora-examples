/** First claim requires the distributor's independently obtained Merkle proof. */
import { buildNewAmmoraMerkleDistributorClaim } from "@ammora-protocol/sdk";
import type { Hex } from "viem";
import { pinned, natural, execute } from "../shared/actions.js";
import { main } from "../shared/run.js";
main(async () => {
  const unlocked = natural(process.argv[3], "unlockedRaw"), locked = natural(process.argv[4], "lockedRaw");
  if (unlocked + locked === 0n) throw new Error("Claim amount must be positive");
  const proof = process.argv[5] === "empty" ? [] : (process.argv[5] ?? "").split(",");
  if (proof.some(p => !/^0x[0-9a-fA-F]{64}$/.test(p))) throw new Error("Every proof sibling must be bytes32");
  const c = await pinned(process.argv[2]);
  await execute("Merkle allocation claim", c, { to: c.target, ...buildNewAmmoraMerkleDistributorClaim(unlocked, locked, proof as Hex[]) });
});
