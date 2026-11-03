import { buildRegisterStandardToken, planERC20Approvals } from "@ammora-protocol/sdk";
import { erc20Abi, encodeFunctionData, parseAbi, type Address } from "viem";
import { addr, raw, same } from "../../src/stablecoin/manifest.js";
import type { UnifiedContext } from "./context.js";
import type { UnifiedPlan } from "./operations.js";
const policyAbi = parseAbi(["function tokenPolicyRegistry() view returns(address)", "function policy(address) view returns(uint8,bool,bool,bool)", "function ownerPolicyConfigured(address) view returns(bool)", "function isPoolTokenSupported(address) view returns(bool)"]);
export async function policySnapshot(c: UnifiedContext) {
  const registry = await c.c.readContract({ address: addr(c.f.factory), abi: policyAbi, functionName: "tokenPolicyRegistry" });
  if (!same(registry, c.f.registry)) throw new Error("Factory/Registry binding changed");
  const assets = [];
  for (const role of ["base", "quote"] as const) {
    const token = c.m[role].address!;
    const policy = await c.c.readContract({ address: registry, abi: policyAbi, functionName: "policy", args: [token] });
    const ownerConfigured = await c.c.readContract({ address: registry, abi: policyAbi, functionName: "ownerPolicyConfigured", args: [token] });
    const poolSupported = await c.c.readContract({ address: registry, abi: policyAbi, functionName: "isPoolTokenSupported", args: [token] });
    assets.push({ role, token, policy, ownerConfigured, poolSupported });
  }
  return { factory: addr(c.f.factory), registry, assets };
}
/** No governance write: register only an unclassified reviewed pair token via an exact round trip. */
export async function buildPolicy(c: UnifiedContext, operation: "register" | "register-approve", r: Record<string, unknown>): Promise<UnifiedPlan> {
  if (!same(c.caller, c.m.roles.liquidityOwner!)) throw new Error("Only the reviewed LP/probe wallet may register or approve");
  const token = addr(r.token), amount = raw(r.amount, operation === "register");
  const asset = ["base", "quote"].find(k => same(c.m[k as "base" | "quote"].address!, token));
  if (!asset) throw new Error("Registration token is outside the reviewed pair");
  const cap = BigInt(asset === "base" ? c.m.policy.maxBaseRaw : c.m.policy.maxQuoteRaw);
  if (amount > cap) throw new Error("Probe budget exceeded");
  const snapshot = await policySnapshot(c);
  if (r.spender !== undefined && !same(addr(r.spender), snapshot.registry)) throw new Error("Registry spender mismatch");
  const state = snapshot.assets.find(a => same(a.token, token))!;
  // Zero revocation must remain possible after successful registration/classification.
  if (amount > 0n) {
    if (state.ownerConfigured || state.policy[0] !== 0) throw new Error("Preserve classified/owner token policy; do not re-register");
    if (await c.c.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [c.caller] }) < amount) throw new Error("Insufficient probe balance");
  }
  const requirement = { token, spender: snapshot.registry, amount };
  if (operation === "register") return { transactions: [{ to: snapshot.registry, ...buildRegisterStandardToken(token, amount), value: 0n }], approvals: [requirement], registryProbe: { token, amount }, summary: { ...snapshot, token, amount, action: "EXACT_ROUND_TRIP_REGISTRATION" } };
  if (amount === 0n) {
    const allowance = await c.c.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [c.caller, snapshot.registry] });
    return { transactions: allowance === 0n ? [] : [{ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [snapshot.registry, 0n] }), value: 0n }], approvals: [], summary: { token, spender: snapshot.registry, amount, allowance, action: "EXPLICIT_REGISTRY_ALLOWANCE_REVOCATION" } };
  }
  const plans = await planERC20Approvals(c.c, c.caller, [requirement]);
  return { transactions: plans.flatMap(p => p.transactions), approvals: [], summary: { ...snapshot, token, spender: snapshot.registry, amount, action: "EXACT_REGISTRY_PROBE_APPROVAL" } };
}
