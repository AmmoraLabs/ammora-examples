import { zeroAddress, type Address } from "viem";
import type { AmmoraTransaction } from "@ammora-protocol/sdk";
export const poolKind = (value: string | undefined): "concentrated" | "compounding" => {
  if (value !== "concentrated" && value !== "compounding") throw new Error("pool kind must be concentrated or compounding");
  return value;
};
export function requireOwner(owner: Address, caller: Address) {
  if (owner === zeroAddress || owner.toLowerCase() !== caller.toLowerCase()) throw new Error("This owner-only example requires the direct pool NFT owner; a managed NFT ID is not a pool ID");
}
export function sameTransaction(checked: AmmoraTransaction, raw: AmmoraTransaction) {
  if (checked.to.toLowerCase() !== raw.to.toLowerCase() || checked.data !== raw.data || (checked.value ?? 0n) !== (raw.value ?? 0n)) throw new Error("Raw builder differs from checked planner");
  return checked; // Only the checked transaction is submitted, once.
}
export function partialAccounting(maximum: bigint, quote: { amountIn: bigint; amountLeft: bigint; amountOut: bigint }) {
  if (maximum <= 0n || quote.amountIn <= 0n || quote.amountOut <= 0n || quote.amountLeft < 0n || quote.amountIn + quote.amountLeft !== maximum) throw new Error("Invalid partial-fill accounting");
  return { maximumInput: maximum, consumedInput: quote.amountIn, unusedInput: quote.amountLeft, output: quote.amountOut };
}
export function requirePositiveReward(claimable: bigint) {
  if (claimable <= 0n) throw new Error("No positive reward; a zero-fee/no-op is not a payout");
}
export function requireHelper(value: Address | null | undefined, label: string): asserts value is Address {
  if (!value || value === zeroAddress) throw new Error(`${label} is not in the reviewed lifecycle targets; deployment, runtime pin and permission qualification are required`);
}
