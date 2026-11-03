import { ammConcentratedPositionManagerV3Abi } from "@ammora-protocol/sdk";
import { arl } from "../shared/actions.js";
import { reader, v4Deployment } from "../shared/env.js";
import { feeVaultContext } from "../fees/context.js";
import type { SourcePolicy } from "./source-policy.js";

/** Source permission is not provenance: independently authenticate each protocol source. */
export async function authenticateSource(p: SourcePolicy) {
  if (p.kind === "feeVault" || p.kind === "delegatedFeeVault") { await feeVaultContext(p.source); return; }
  if (p.kind === "compoundingFee" || p.kind === "positionReward" && p.sourceKind === "compounding") { await arl(p.source, "compounding"); return; }
  if (p.sourceKind === "rawPool") { await arl(p.source, "concentrated"); return; }
  const manager = v4Deployment().contracts.launch.concentratedPositionManager;
  if (p.source.toLowerCase() !== manager.toLowerCase()) throw new Error("Source is not the reviewed PositionManager");
  const client = await reader();
  const position = await client.readContract({ address: manager, abi: ammConcentratedPositionManagerV3Abi, functionName: "getPosition", args: [p.tokenId] });
  await arl(position.pool, "concentrated");
}
