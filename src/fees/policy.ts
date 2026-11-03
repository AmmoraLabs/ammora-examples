import { readFileSync } from "node:fs";
import { getAddress, zeroAddress, type Address } from "viem";

export const nonzero = (value: unknown, label: string): Address => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} must be an address`);
  const result = getAddress(value.toLowerCase());
  if (result === zeroAddress) throw new Error(`${label} must be nonzero`);
  return result;
};
export const uint = (value: unknown, label: string, positive = false): bigint => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${label} must be a raw integer string`);
  const n = BigInt(value);
  if (n >= 1n << 256n || positive && n === 0n) throw new Error(`${label} outside uint256 range`);
  return n;
};
export const object = (value: unknown, keys: string[]): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error("Unknown JSON field; review the schema");
  return value as Record<string, unknown>;
};
export const document = (file: string | undefined): unknown => {
  if (!file) throw new Error("Pass the reviewed JSON file");
  return JSON.parse(readFileSync(file, "utf8"));
};
export function feeRequests(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) throw new Error("Provide 1–16 fee requests");
  const seen = new Set<string>();
  return value.map(entry => {
    const r = object(entry, ["vault", "token", "beneficiary", "payout"]);
    const result = { vault: nonzero(r.vault, "vault"), token: nonzero(r.token, "token"),
      beneficiary: nonzero(r.beneficiary, "beneficiary"), payout: nonzero(r.payout, "payout") };
    const key = [result.vault, result.token, result.beneficiary].join(":").toLowerCase();
    if (seen.has(key)) throw new Error("Duplicate entitlement; a different payout does not create a second claim");
    if (result.payout === result.vault) throw new Error("Payout must be outside the vault");
    seen.add(key); return result;
  });
}
export function rebalancePolicy(value: unknown) {
  const r = object(value, ["tokenId", "withdrawals", "deposits", "slippageBps", "maxActiveBinSlippage", "recipient", "deadline"]);
  const bins = <T>(value: unknown, keys: string[], parse: (r: Record<string, unknown>, binId: number) => T): T[] => {
    if (!Array.isArray(value)) throw new Error("Bin entries must be arrays");
    const seen = new Set<number>();
    return value.map(entry => {
      const item = object(entry, ["binId", ...keys]), binId = item.binId;
      if (!Number.isSafeInteger(binId) || Number(binId) < -8388608 || Number(binId) > 8388607 || seen.has(Number(binId))) throw new Error("Bins must be unique int24 values");
      seen.add(Number(binId)); return parse(item, Number(binId));
    });
  };
  const withdrawals = bins(r.withdrawals, ["shares"], (item, binId) => ({ binId, shares: uint(item.shares, "shares", true) }));
  const deposits = bins(r.deposits, ["baseAmount", "quoteAmount"], (item, binId) => {
    const baseAmount = uint(item.baseAmount, "baseAmount"), quoteAmount = uint(item.quoteAmount, "quoteAmount");
    if (baseAmount + quoteAmount === 0n) throw new Error("Deposit must be positive");
    return { binId, baseAmount, quoteAmount };
  });
  if (withdrawals.length + deposits.length < 1 || withdrawals.length + deposits.length > 64) throw new Error("Provide 1–64 bin operations");
  for (const [label, max] of [["slippageBps", 9999], ["maxActiveBinSlippage", 100]] as const) {
    if (!Number.isSafeInteger(r[label]) || Number(r[label]) < 0 || Number(r[label]) > max) throw new Error(`${label} outside reviewed range`);
  }
  return { tokenId: uint(r.tokenId, "tokenId"), withdrawals, deposits, slippageBps: Number(r.slippageBps),
    maxActiveBinSlippage: Number(r.maxActiveBinSlippage), recipient: nonzero(r.recipient, "recipient"), deadline: uint(r.deadline, "deadline", true) };
}
