import { createHash } from "node:crypto";
import { planAmmoraLaunchVesting, type AmmoraTokenLockCreatePlan, type AmmoraTokenLockClaimPlan } from "@ammora-protocol/sdk";
import { getAddress, zeroAddress, type Address, type Hex } from "viem";
export const uint = (v: unknown, name: string): bigint => {
  if (typeof v !== "string" || !/^(0|[1-9]\d*)$/.test(v) || BigInt(v) >= 1n << 256n) throw new Error(`${name} must be a uint256 decimal string`);
  return BigInt(v);
};
export function object(v: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Expected an object");
  const r = v as Record<string, unknown>;
  if (Object.keys(r).length !== fields.length || fields.some(f => !(f in r))) throw new Error(`Required fields: ${fields.join(", ")}`);
  return r;
}
export function addr(v: unknown): Address {
  if (typeof v !== "string" || !/^0x[\da-fA-F]{40}$/.test(v) || v.toLowerCase() === zeroAddress) throw new Error("Expected nonzero address");
  return getAddress(v.toLowerCase());
}
export function hash(v: unknown): Hex {
  if (typeof v !== "string" || !/^0x[\da-fA-F]{64}$/.test(v)) throw new Error("Expected bytes32");
  return v.toLowerCase() as Hex;
}
export function allocation(value: unknown) {
  const r = object(value, ["totalAmountRaw", "cliffUnlockAmountRaw", "numberOfPeriods", "frequencySeconds", "cliffDurationSeconds", "rounding"]);
  if (typeof r.numberOfPeriods !== "number" || !Number.isSafeInteger(r.numberOfPeriods)) throw new Error("numberOfPeriods must be an integer");
  if (r.rounding !== "reject" && r.rounding !== "cliff") throw new Error("Choose reject or cliff rounding");
  return planAmmoraLaunchVesting({ totalAmountRaw: uint(r.totalAmountRaw, "total"), cliffUnlockAmountRaw: uint(r.cliffUnlockAmountRaw, "cliff"),
    numberOfPeriods: r.numberOfPeriods, frequencySeconds: uint(r.frequencySeconds, "frequency"), cliffDurationSeconds: uint(r.cliffDurationSeconds, "delay"), rounding: r.rounding });
}
/** This example intentionally creates irrevocable locks with an immutable recipient. */
export function createRequest(value: unknown) {
  const r = object(value, ["token", "recipient", "vestingStartTime", "allocation", "userSalt", "metadataHash"]);
  const a = allocation(r.allocation), start = uint(r.vestingStartTime, "vestingStartTime");
  if (a.totalAmountRaw === 0n || start + a.durationSeconds >= 1n << 64n) throw new Error("Nonzero allocation and uint64 schedule required");
  return { token: addr(r.token), recipient: addr(r.recipient), userSalt: hash(r.userSalt), parameters: {
    vestingStartTime: start, cliffTime: start + a.config.cliffDuration, frequency: a.config.frequency,
    cliffUnlockAmount: a.config.cliffUnlockAmount, amountPerPeriod: a.config.amountPerPeriod,
    numberOfPeriods: a.config.numberOfPeriods, cancelMode: 0, updateRecipientMode: 0, metadataHash: hash(r.metadataHash),
  } };
}
export type VestingPlan = AmmoraTokenLockCreatePlan | AmmoraTokenLockClaimPlan;
export function reviewHash(plan: VestingPlan): string {
  const payload = "status" in plan
    ? { action: "create", caller: plan.creator, recipient: plan.recipient, token: plan.token, lock: plan.lock, parameters: plan.parameters, salt: plan.salt, totalAmount: plan.totalAmount, status: plan.status, transaction: plan.transaction }
    : { action: "claim", caller: plan.caller, recipient: plan.state.recipient, token: plan.state.token, lock: plan.state.address, amount: plan.amount, totalClaimed: plan.state.totalClaimed, transaction: plan.transaction };
  return createHash("sha256").update(JSON.stringify(payload, (_, v) => typeof v === "bigint" ? String(v) : v)).digest("hex");
}
export function assertReview(plan: VestingPlan, expected: string | undefined) {
  if (!expected || expected !== reviewHash(plan)) throw new Error("Review the fresh plan and supply its exact reviewHash; approval/amount/state changes require a new review");
}
