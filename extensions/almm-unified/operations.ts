import { policySnapshot, buildPolicy } from "./policy.js";
import { ALMMClient, ALMMFactoryClient, almmPositionManagerAbi, planERC20Approvals, getALMMBinIdFromPriceX128, getALMMPriceX128FromBinId, type AmmoraTransaction, type ERC20ApprovalRequirement } from "@ammora-protocol/sdk";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { addr, int, obj, raw, same } from "../../src/stablecoin/manifest.js";
import { budget, priceGuard, quoteFloor } from "../../src/stablecoin/context.js";
import { getALMMFeeClaimReadiness, planSetALMMFeeClaimDelegate, planRevokeALMMFeeClaimDelegate, planClaimALMMPositionFeesTo } from "./fee-claims-compat.js";
import { requireReviewedFeeOwner, requireReviewedGrant } from "./roles.js";
import type { UnifiedContext } from "./context.js";
export type Operation = "policy" | "register-approve" | "register" | "create" | "discover" | "approve" | "seed" | "swap" | "inspect" | "grant" | "revoke" | "claim" | "exit" | "close";
export type UnifiedPlan = { transactions: readonly AmmoraTransaction[]; approvals: readonly ERC20ApprovalRequirement[]; summary: unknown; registryProbe?: { token: `0x${string}`; amount: bigint }; payout?: { recipient: `0x${string}`; tokenId: bigint } };
export async function buildUnified(c: UnifiedContext, operation: Operation, value: unknown): Promise<UnifiedPlan> {
  const r = obj(value, ["pool", "tokenId", "binStepBps", "maximumBaseRaw", "maximumQuoteRaw", "lowerBinId", "upperBinId", "includedAmountIn", "baseForQuote", "slippageBps", "deadline", "delegate", "recipient", "expiresAt", "recipientMode", "revokeAll", "binIds", "token", "spender", "amount"]);
  const owner = () => { if (!same(c.caller, c.m.roles.liquidityOwner!)) throw new Error("Only reviewed liquidity owner changes principal"); };
  const deadline = () => { const t = raw(r.deadline); if (t <= c.block.timestamp || t > c.block.timestamp + BigInt(c.m.policy.planTtlSeconds)) throw new Error("Supply a fresh explicit deadline within the manifest TTL"); return t; };
  const slippage = () => int(r.slippageBps, 0, c.m.policy.maxSlippageBps);
  const empty = (summary: unknown): UnifiedPlan => ({ transactions: [], approvals: [], summary });
  if (operation === "policy") return empty(await policySnapshot(c));
  if (operation === "register" || operation === "register-approve") return buildPolicy(c, operation, r);
  if (operation === "create" || operation === "discover") {
    if (operation === "create") owner(); const binStepBps = int(r.binStepBps, 1, 400);
    const priceX128 = parseUnits(c.m.reference.quotePerBase, 18) * 2n ** 128n * 10n ** BigInt(c.m.quote.decimals!) / (10n ** 18n * 10n ** BigInt(c.m.base.decimals!));
    const activeId = getALMMBinIdFromPriceX128(priceX128, binStepBps);
    priceGuard(c.m, getALMMPriceX128FromBinId(activeId, binStepBps) * 10n ** BigInt(c.m.base.decimals!) * 10n ** 18n / (2n ** 128n * 10n ** BigInt(c.m.quote.decimals!)));
    if (c.f.defaultFeeBps > c.m.policy.maxFeeBps) throw new Error("Default fee exceeds reviewed cap");
    const factory = new ALMMFactoryClient(c.c, addr(c.f.factory), c.options);
    const input = { baseToken: c.m.base.address!, quoteToken: c.m.quote.address!, binStepBps, activeId };
    const p = await factory.getPoolCreationPreflight(input);
    if (operation === "discover") {
      const existing = !same(p.existingPool, "0x0000000000000000000000000000000000000000");
      const state = existing ? await new ALMMClient(c.c, p.existingPool, addr(c.f.manager), addr(c.f.lens), c.options).getPoolState() : null;
      if (state && (!same(state.baseToken, input.baseToken) || !same(state.quoteToken, input.quoteToken) || state.currentFeeBps > c.m.policy.maxFeeBps || state.binStepBps !== binStepBps)) throw new Error("Discovered pool differs from reviewed pair/economics");
      return empty({ route: existing ? "existing-pool" : "new-pool", preflight: p, state });
    }
    if (!p.ready) throw new Error(p.issues.join("; "));
    return { transactions: [p.transaction], approvals: [], summary: p };
  }
  if (operation === "approve") {
    owner(); const token = addr(r.token), spender = addr(r.spender), amount = raw(r.amount, false);
    if (![c.m.base.address!, c.m.quote.address!].some(a => same(a, token)) || ![c.f.manager, ...(c.pool ? [c.pool] : [])].some(a => same(a, spender))) throw new Error("Unreviewed approval token/spender");
    budget(c.m, same(token, c.m.base.address!) ? amount : 0n, same(token, c.m.quote.address!) ? amount : 0n);
    // Minimum-allowance planners skip a zero requirement; revocation is an explicit write.
    if (amount === 0n) {
      const current = await c.c.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [c.caller, spender] });
      return { transactions: current === 0n ? [] : [{ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, 0n] }) }], approvals: [], summary: { token, spender, amount, current, action: "EXPLICIT_ALLOWANCE_REVOCATION" } };
    }
    const plans = await planERC20Approvals(c.c, c.caller, [{ token, spender, amount }]);
    const transactions = plans.flatMap(p => p.transactions);
    if (transactions.length > 1) throw new Error("Review a zero-amount reset separately before nonzero approval");
    return { transactions, approvals: [], summary: { token, spender, amount } };
  }
  if (!c.sdk || !c.pool) throw new Error("Supply a recognized pool");
  if (operation === "seed") {
    owner(); const b = raw(r.maximumBaseRaw, false), q = raw(r.maximumQuoteRaw, false); budget(c.m, b, q);
    const lowerBinId = int(r.lowerBinId, -8388607, 8388607), upperBinId = int(r.upperBinId, lowerBinId, Math.min(8388607, lowerBinId + 63));
    const p = await c.sdk.planCreateStrategyPosition({ lowerBinId, upperBinId, totalBaseAmount: b, totalQuoteAmount: q, strategy: 0, shareSlippageBps: slippage(), maxActiveBinSlippage: 0, recipient: c.caller, deadline: deadline() });
    if (c.m.roles.feeOwner && !same(c.m.roles.feeOwner, c.caller)) {
      // Same reviewed strategy quote, explicit independent fee ownership, no time lock.
      const deposits = p.quote.binIds.map((binId, i) => ({ binId, baseAmount: p.quote.baseAmounts[i]!, quoteAmount: p.quote.quoteAmounts[i]!, minimumShares: p.quote.minimumShares[i]! }));
      const transaction = { to: addr(c.f.manager), data: encodeFunctionData({ abi: almmPositionManagerAbi, functionName: "createBootstrapPosition", args: [c.pool, deposits, c.caller, c.m.roles.feeOwner, c.caller, 0n, deadline()] }) };
      return { transactions: [transaction], approvals: p.approvalRequirements, summary: { ...p.quote, feeOwner: c.m.roles.feeOwner, operator: c.caller, lockReleasePoint: 0n, mode: "EXPLICIT_INDEPENDENT_FEE_OWNER" } };
    }
    return { transactions: [p.transaction], approvals: p.approvalRequirements, summary: p.quote };
  }
  if (operation === "swap") {
    if (typeof r.baseForQuote !== "boolean") throw new Error("baseForQuote must be boolean");
    const amount = raw(r.includedAmountIn); budget(c.m, r.baseForQuote ? amount : 0n, r.baseForQuote ? 0n : amount);
    const p = await c.sdk.planSwapExactInput({ includedAmountIn: amount, baseForQuote: r.baseForQuote, allowPartialFill: false, slippageBps: slippage(), recipient: c.caller, deadline: deadline() });
    quoteFloor(c.m, r.baseForQuote, amount, p.quote.amountOut);
    return { transactions: [p.transaction], approvals: p.approvalRequirements, summary: p.quote };
  }
  const tokenId = raw(r.tokenId, false), recipient = r.recipient === undefined ? c.m.roles.payout! : addr(r.recipient);
  if (!same(recipient, c.m.roles.payout!)) throw new Error("Review the alternate payout in the manifest before planning");
  if (r.binIds !== undefined && !Array.isArray(r.binIds)) throw new Error("binIds must be an array");
  const request = { pool: c.pool, tokenId, caller: c.caller, recipient, ...(r.binIds === undefined ? {} : { binIds: (r.binIds as unknown[]).map(x => int(x, -8388607, 8388607)) }) };
  if (operation === "inspect") { const readiness = await getALMMFeeClaimReadiness(c.client, request, c.feeOptions); requireReviewedFeeOwner(c.m, readiness.position.feeOwner); return empty(readiness); }
  if (operation === "grant") {
    requireReviewedGrant(c.m, addr(r.delegate));
    if (r.recipientMode !== undefined && !["fixed", "any"].includes(String(r.recipientMode))) throw new Error("Select fixed or explicit any mode");
    const p = await planSetALMMFeeClaimDelegate(c.client, { ...request, delegate: addr(r.delegate), expiresAt: raw(r.expiresAt, false), recipientMode: r.recipientMode as "fixed" | "any" | undefined }, c.feeOptions);
    requireReviewedFeeOwner(c.m, p.readiness.position.feeOwner);
    return { transactions: [p.transaction], approvals: p.approvalRequirements, summary: { authority: p.authority, readiness: p.readiness } };
  }
  if (operation === "revoke") {
    if (r.revokeAll !== undefined && typeof r.revokeAll !== "boolean") throw new Error("revokeAll must be boolean");
    if (r.revokeAll === true && r.delegate !== undefined) throw new Error("Choose one delegate or revokeAll");
    const p = await planRevokeALMMFeeClaimDelegate(c.client, { ...request, ...(r.revokeAll === true ? {} : { delegate: addr(r.delegate) }) }, c.feeOptions);
    requireReviewedFeeOwner(c.m, p.readiness.position.feeOwner);
    return { transactions: [p.transaction], approvals: [], summary: p.readiness };
  }
  if (operation === "claim") { const p = await planClaimALMMPositionFeesTo(c.client, request, c.feeOptions); requireReviewedFeeOwner(c.m, p.readiness.position.feeOwner); return { transactions: p.transactions, approvals: [], summary: p.readiness, payout: { recipient, tokenId } }; }
  owner();
  if (operation === "exit") {
    const bins = await c.c.readContract({ address: addr(c.f.manager), abi: almmPositionManagerAbi, functionName: "getPositionBins", args: [tokenId] });
    if (bins.length === 0 || bins.length > 64) throw new Error("This full-exit example supports 1..64 bins; chunk extended positions first");
    const withdrawals = []; for (const binId of bins) { const shares = await c.c.readContract({ address: addr(c.f.manager), abi: almmPositionManagerAbi, functionName: "positionShares", args: [tokenId, binId] }); if (shares > 0n) withdrawals.push({ binId, shares }); }
    const p = await c.sdk.planRebalancePosition({ tokenId, caller: c.caller, withdrawals, deposits: [], slippageBps: slippage(), maxActiveBinSlippage: 0, recipient: c.caller, deadline: deadline() });
    return { transactions: [p.transaction], approvals: [], summary: p };
  }
  if (operation === "close") { const p = await c.sdk.planCloseEmptyPosition({ tokenId, caller: c.caller }); return { transactions: [p.transaction], approvals: [], summary: p.context }; }
  throw new Error("Unknown operation");
}
