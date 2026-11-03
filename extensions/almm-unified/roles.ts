import { addr, manifest, obj, raw, same, type Manifest } from "../../src/stablecoin/manifest.js";
import type { Address } from "viem";

export type UnifiedManifest = Omit<Manifest, "roles"> & { roles: Manifest["roles"] & { feeOwner?: Address } };
/** Optional independent bootstrap fee owner; ordinary LP manifests remain compatible. */
export function unifiedManifest(value: unknown): UnifiedManifest {
  const valueObject = obj(value, ["schemaVersion", "chainId", "generation", "id", "origin", "model", "base", "quote", "roles", "policy", "reference", "deployment"]);
  const roles = obj(valueObject.roles, ["liquidityOwner", "feeOwner", "payout", "feeDelegate"]);
  const { feeOwner, ...baseRoles } = roles;
  const result = manifest({ ...valueObject, roles: baseRoles });
  return { ...result, roles: { ...result.roles, ...(feeOwner === undefined ? {} : { feeOwner: addr(feeOwner) }) } };
}
/** The same review boundary must be applied while planning and immediately before signing. */
export function requiresExposureReview(operation: string, request: Record<string, unknown>): boolean {
  return ["create", "seed", "swap"].includes(operation) || operation === "approve" && raw(request.amount, false) > 0n;
}
export function reviewedCaller(m: UnifiedManifest, caller: Address): boolean {
  return [m.roles.liquidityOwner, m.roles.feeOwner, m.roles.feeDelegate].some(a => a && same(a, caller));
}
export function requireReviewedFeeOwner(m: UnifiedManifest, actual: Address): void {
  if (m.roles.feeOwner && !same(m.roles.feeOwner, actual)) throw new Error("Reviewed feeOwner differs from on-chain positionFeeOwner: " + actual);
}
export function requireReviewedGrant(m: UnifiedManifest, delegate: Address): void {
  if (!m.roles.feeDelegate || !same(m.roles.feeDelegate, delegate)) throw new Error("Review this delegate in roles.feeDelegate before granting fee authority");
}
