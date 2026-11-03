/** dfs:position-permission -- <vault> <pool> <concentrated|compounding> <nftId> <fee|reward|revoke>.
 * Exact fee/reward bits only. Concentrated uses Manager NFTs; raw NFT approval is a broader, separate operation. */
import { ammConcentratedPositionManagerV3Abi, ammCompoundingPoolV3Abi, buildUpdateManagedAmmDelegatePermission, buildUpdateCompoundingDelegatePermission } from "@ammora-protocol/sdk";
import { zeroAddress } from "viem";
import { dfs } from "./context.js";
import { sourcePermission } from "./source-policy.js";
import { arl, natural, execute } from "../shared/actions.js";
import { v4Deployment } from "../shared/env.js";
import { main } from "../shared/run.js";
import { printJson } from "../shared/input.js";
main(async () => {
  const [vault, pool, kind, id, mode, ...extra] = process.argv.slice(2);
  if (extra.length || !["concentrated", "compounding"].includes(kind ?? "")) throw new Error("Select a pool kind and exact fee/reward/revoke mode");
  const permission = sourcePermission(mode);
  const d = await dfs(vault), c = await arl(pool, kind as "concentrated" | "compounding"), tokenId = natural(id, "nftId");
  const target = kind === "concentrated" ? v4Deployment().contracts.launch.concentratedPositionManager : c.pool;
  const abi = kind === "concentrated" ? ammConcentratedPositionManagerV3Abi : ammCompoundingPoolV3Abi;
  const owner = await c.client.readContract({ address: target, abi, functionName: "ownerOf", args: [tokenId] });
  if (owner.toLowerCase() !== c.caller.toLowerCase()) throw new Error("Only actual NFT owner may configure DFS permissions");
  if (kind === "concentrated") {
    const p = await c.client.readContract({ address: target, abi: ammConcentratedPositionManagerV3Abi, functionName: "getPosition", args: [tokenId] });
    if (p.pool.toLowerCase() !== c.pool.toLowerCase()) throw new Error("Manager NFT belongs to another pool");
  }
  const previous = await c.client.readContract({ address: target, abi, functionName: "positionDelegate", args: [tokenId] });
  const previousPermission = await c.client.readContract({ address: target, abi, functionName: "delegatePermission", args: [tokenId] });
  if (previous !== zeroAddress && previous.toLowerCase() !== d.vault.toLowerCase()) throw new Error("Another delegate exists; do not replace its slot implicitly");
  const delegate = permission ? d.vault : zeroAddress;
  const call = kind === "concentrated" ? buildUpdateManagedAmmDelegatePermission(tokenId, delegate, permission) : buildUpdateCompoundingDelegatePermission(tokenId, delegate, permission);
  printJson({ target, tokenId, previous, previousPermission, delegate, permission, note: "Replaces the single slot with EXACT bits; no principal/NFT-transfer permission" });
  await execute("set DFS fee/reward position permission", c, { to: target, ...call });
});
