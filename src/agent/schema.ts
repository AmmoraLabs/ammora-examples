import { createHash } from "node:crypto";
import { getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { parseTeamRecipientPolicy } from "../launch/team/policy.js";
import type { AgentPolicy, Intent } from "./types.js";

export function invariant(ok: unknown, code: string): asserts ok { if (!ok) throw new Error(code); }
export function object(raw: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  invariant(raw && typeof raw === "object" && !Array.isArray(raw), "INVALID_OBJECT");
  const o = raw as Record<string, unknown>;
  invariant(required.every(k => Object.hasOwn(o, k)) && Object.keys(o).every(k => [...required, ...optional].includes(k)), "UNEXPECTED_FIELDS");
  return o;
}
export function uint(raw: unknown, positive = false): string {
  invariant(typeof raw === "string" && /^(0|[1-9][0-9]{0,77})$/.test(raw), "INVALID_RAW_AMOUNT");
  invariant(BigInt(raw) < 2n ** 256n && (!positive || BigInt(raw) > 0n), "AMOUNT_OUT_OF_RANGE");
  return raw;
}
export function address(raw: unknown): Address {
  invariant(typeof raw === "string" && isAddress(raw) && raw.toLowerCase() !== zeroAddress, "INVALID_ADDRESS");
  return getAddress(raw);
}
export const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export function text(raw: unknown, max: number): string {
  invariant(typeof raw === "string" && raw.length > 0 && Buffer.byteLength(raw) <= max && !/[\x00-\x1f]/.test(raw), "INVALID_TEXT");
  return raw;
}
export function integer(raw: unknown, min: number, max: number): number {
  invariant(typeof raw === "number" && Number.isSafeInteger(raw) && raw >= min && raw <= max, "INVALID_INTEGER"); return raw;
}
export function parseIntent(raw: unknown, internal = false): Intent {
  const action = (raw as { action?: unknown } | null)?.action;
  switch (action) {
    case "config": {
      const o = object(raw, ["action", "policy", "saleSupplyRaw", "thresholdRaw"]);
      return { action, policy: parseTeamRecipientPolicy(o.policy), saleSupplyRaw: uint(o.saleSupplyRaw, true), thresholdRaw: uint(o.thresholdRaw, true) };
    }
    case "launch": {
      const o = object(raw, ["action", "configId", "name", "symbol", "metadataURI"], ["firstBuyRaw", "minimumBaseRaw"]);
      invariant((o.firstBuyRaw === undefined) === (o.minimumBaseRaw === undefined), "FIRST_BUY_REQUIRES_MINIMUM");
      return { action, configId: uint(o.configId, true), name: text(o.name, 128), symbol: text(o.symbol, 32), metadataURI: text(o.metadataURI, 512),
        ...(o.firstBuyRaw === undefined ? {} : { firstBuyRaw: uint(o.firstBuyRaw, true), minimumBaseRaw: uint(o.minimumBaseRaw, true) }) };
    }
    case "config-first-buy": {
      const o = object(raw, ["action", "policy", "saleSupplyRaw", "thresholdRaw", "name", "symbol", "metadataURI", "firstBuyRaw", "minimumBaseRaw"]);
      return { action, policy: parseTeamRecipientPolicy(o.policy), saleSupplyRaw: uint(o.saleSupplyRaw, true), thresholdRaw: uint(o.thresholdRaw, true),
        name: text(o.name, 128), symbol: text(o.symbol, 32), metadataURI: text(o.metadataURI, 512), firstBuyRaw: uint(o.firstBuyRaw, true), minimumBaseRaw: uint(o.minimumBaseRaw, true) };
    }
    case "trade": {
      const o = object(raw, ["action", "curve", "side", "amountRaw", "slippageBps"], ["graduationBoundary", "payout"]);
      invariant(o.side === "buy" || o.side === "sell", "INVALID_SIDE");
      invariant(o.graduationBoundary === undefined || typeof o.graduationBoundary === "boolean", "INVALID_BOUNDARY");
      invariant(!o.graduationBoundary || o.side === "buy", "BOUNDARY_BUY_ONLY");
      return { action, curve: address(o.curve), side: o.side, amountRaw: uint(o.amountRaw, true), slippageBps: integer(o.slippageBps, 0, 1000),
        ...(o.payout === undefined ? {} : { payout: address(o.payout) }), ...(o.graduationBoundary === undefined ? {} : { graduationBoundary: o.graduationBoundary }) };
    }
    case "migrate": { const o = object(raw, ["action", "curve"]); return { action, curve: address(o.curve) }; }
    case "claim-launch": {
      const o = object(raw, ["action", "curve", "asset"], ["payout"]); invariant(o.asset === "base" || o.asset === "quote", "INVALID_ASSET");
      return { action, curve: address(o.curve), asset: o.asset, ...(o.payout === undefined ? {} : { payout: address(o.payout) }) };
    }
    case "claim-lp": {
      const o = object(raw, ["action", "curve", "tokenId"], ["payout"]);
      return { action, curve: address(o.curve), tokenId: uint(o.tokenId), ...(o.payout === undefined ? {} : { payout: address(o.payout) }) };
    }
    case "approval": {
      invariant(internal, "APPROVAL_REQUIRES_PARENT_PLAN");
      const o = object(raw, ["action", "parentId", "requirementIndex", "reset"]); invariant(typeof o.reset === "boolean", "INVALID_RESET");
      return { action, parentId: text(o.parentId, 128), requirementIndex: integer(o.requirementIndex, 0, 8), reset: o.reset };
    }
    default: throw new Error("UNSUPPORTED_ACTION");
  }
}
export function canonical(value: unknown): string {
  const visit = (v: unknown): unknown => typeof v === "bigint" ? String(v) : Array.isArray(v) ? v.map(visit)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, visit(x)])) : v;
  return JSON.stringify(visit(value));
}
export const digest = (value: unknown): Hex => `0x${createHash("sha256").update(canonical(value)).digest("hex")}`;
export type Jsonified<T> = T extends bigint ? string : T extends readonly (infer U)[] ? Jsonified<U>[] : T extends object ? { [K in keyof T]: Jsonified<T[K]> } : T;
/** Public result types match JSON reality: raw bigint values become decimal strings. */
export const publicJson = <T>(value: T): Jsonified<T> => JSON.parse(canonical(value)) as Jsonified<T>;
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function validatePolicy(raw: AgentPolicy): AgentPolicy {
  const p = structuredClone(raw);
  text(p.sessionId, 128); address(p.account);
  // An expired session must still reopen for historical reconciliation, never for a new send.
  integer(p.expiresAt, 1, Math.floor(Date.now() / 1000) + 86400);
  invariant(p.actions.length > 0 && p.actions.every(a => ["config", "launch", "config-first-buy", "trade", "migrate", "claim-launch", "claim-lp", "approval"].includes(a)), "INVALID_ACTION_POLICY");
  invariant(p.configs.length > 0 && p.configs.every(c => uint(c.id, true) && /^0x[0-9a-fA-F]{64}$/.test(c.hash)), "INVALID_CONFIG_POLICY");
  invariant(p.payouts.length > 0, "PAYOUT_POLICY_REQUIRED"); p.payouts.forEach(address);
  for (const asset of [...p.assets, { token: p.account, ...p.launchTokenLimit }]) {
    address(asset.token); uint(asset.maxInputRaw, true); uint(asset.maxSessionInputRaw, true);
    invariant(BigInt(asset.maxInputRaw) <= BigInt(asset.maxSessionInputRaw), "INVALID_ASSET_POLICY");
  }
  uint(p.maxNativePerTransactionWei, true); uint(p.maxNativeSessionWei, true); uint(p.maxFeePerGasWei, true);
  invariant(BigInt(p.maxNativePerTransactionWei) <= BigInt(p.maxNativeSessionWei), "INVALID_NATIVE_POLICY");
  integer(p.maxTransactions, 1, 1000); integer(p.maxSlippageBps, 0, 1000);
  integer(p.maxPlanAgeSeconds, 10, 600); integer(p.maxPlanAgeBlocks, 1, 600);
  return freeze(p);
}
