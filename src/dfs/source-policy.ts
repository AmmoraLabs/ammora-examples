import type { Address } from "viem";
import { object, nonzero, uint } from "../fees/policy.js";
/** A one-token DFS needs only one source entitlement, not both fee and distinct reward assets. */
export const sourcePermission = (mode: string | undefined): 0 | 8 | 32 => {
  if (mode === "revoke") return 0;
  if (mode === "fee") return 8;
  if (mode === "reward") return 32;
  throw new Error("Select fee, reward, or revoke; one-token DFS does not need combined permissions");
};
export type SourcePolicy =
  | { kind: "feeVault"; source: Address }
  | { kind: "delegatedFeeVault"; source: Address; beneficiary: Address }
  | { kind: "compoundingFee"; source: Address; tokenId: bigint }
  | { kind: "concentratedFee"; source: Address; sourceKind: "rawPool" | "positionManager"; tokenId: bigint; tokenIsBase: boolean }
  | { kind: "positionReward"; source: Address; sourceKind: "rawPool" | "positionManager" | "compounding"; tokenId: bigint; index: number };
export function sourcePolicy(value: unknown): SourcePolicy {
  const r = object(value, ["kind", "source", "beneficiary", "tokenId", "sourceKind", "tokenIsBase", "index"]);
  const source = nonzero(r.source, "source");
  const check = (keys: string[]) => object(r, ["kind", "source", ...keys]);
  if (r.kind === "feeVault") { check([]); return { kind: r.kind, source }; }
  if (r.kind === "delegatedFeeVault") { check(["beneficiary"]); return { kind: r.kind, source, beneficiary: nonzero(r.beneficiary, "beneficiary") }; }
  if (r.kind === "compoundingFee") { check(["tokenId"]); return { kind: r.kind, source, tokenId: uint(r.tokenId, "tokenId") }; }
  if (r.kind === "concentratedFee") {
    check(["tokenId", "sourceKind", "tokenIsBase"]);
    if (!["rawPool", "positionManager"].includes(String(r.sourceKind)) || typeof r.tokenIsBase !== "boolean") throw new Error("Concentrated source requires rawPool/positionManager and boolean tokenIsBase");
    return { kind: r.kind, source, tokenId: uint(r.tokenId, "tokenId"), sourceKind: r.sourceKind as "rawPool" | "positionManager", tokenIsBase: r.tokenIsBase };
  }
  if (r.kind === "positionReward") {
    check(["tokenId", "sourceKind", "index"]);
    if (!["rawPool", "positionManager", "compounding"].includes(String(r.sourceKind)) || ![0,1].includes(Number(r.index)) || typeof r.index !== "number") throw new Error("Reward source requires explicit sourceKind and slot 0/1");
    return { kind: r.kind, source, tokenId: uint(r.tokenId, "tokenId"), sourceKind: r.sourceKind as "rawPool" | "positionManager" | "compounding", index: r.index };
  }
  throw new Error("Unknown source kind");
}
