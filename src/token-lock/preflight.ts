import type { Address } from "viem";

/** A positive payment belongs to the immutable recipient of this lock. */
export const expectedTokenLockClaim = (caller: Address, recipient: Address, claimable: bigint, maximum: bigint): bigint => {
  if (caller.toLowerCase() !== recipient.toLowerCase()) throw new Error("Only the Token Lock recipient can claim");
  if (maximum <= 0n) throw new Error("Token Lock maximum claim must be positive");
  if (claimable <= 0n) throw new Error("Token Lock has no vested claimable balance at this snapshot");
  return claimable < maximum ? claimable : maximum;
};
