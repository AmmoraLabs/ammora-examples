import { ALMMClient, ALMMFactoryClient, almmFactoryAbi } from "@ammora-protocol/sdk";
import { zeroAddress } from "viem";
import { policyAbi, type Context } from "./context.js";
import { int, obj, same } from "./manifest.js";

/** Discovery is unsigned. An existing key never authorizes resending creation. */
export async function discoverAlmmMarket(c: Context, value: unknown) {
  const r = obj(value, ["binStepBps", "activeId", "feeBps"]);
  if (c.m.model !== "almm" || c.fixture) throw new Error("Use the canonical ALMM default route here; preset routes use stablecoin:check-almm-preset");
  const binStepBps = int(r.binStepBps, 1, 400);
  const activeId = int(r.activeId, -8388607, 8388607);
  const requestedFeeBps = int(r.feeBps, 0, c.m.policy.maxFeeBps);
  const preflight = await new ALMMFactoryClient(c.c, c.factory, c.options).getPoolCreationPreflight({
    baseToken: c.m.base.address!, quoteToken: c.m.quote.address!, binStepBps, activeId,
  });
  const defaultFeeBps = await c.c.readContract({ address: c.factory, abi: policyAbi, functionName: "defaultFeeBps" });
  const existing = !same(preflight.existingPool, zeroAddress);
  const blockers = preflight.issues.filter(issue => !(existing && issue === "DLMM canonical pool key already exists"));
  let state: Awaited<ReturnType<ALMMClient["getPoolState"]>> | undefined;
  let economics: Awaited<ReturnType<ALMMClient["getOperatorFeeState"]>> | undefined;
  if (existing) {
    // Mapping + factory provenance, never an address supplied by a URL or caller.
    if (!await c.c.readContract({ address: c.factory, abi: almmFactoryAbi, functionName: "isPool", args: [preflight.existingPool] })) throw new Error("Factory key points to a non-member pool");
    const pool = new ALMMClient(c.c, preflight.existingPool, c.manager, c.d.contracts.liquidityMarketMaker.binLens, c.options);
    state = await pool.getPoolState();
    economics = await pool.getOperatorFeeState(c.caller);
    if (!same(state.baseToken, c.m.base.address!) || !same(state.quoteToken, c.m.quote.address!) || state.binStepBps !== binStepBps) throw new Error("Discovered pool differs from the reviewed pair/bin step");
    blockers.push(...reviewMarketEconomics(requestedFeeBps, c.m.policy.maxFeeBps, state.status, economics));
  } else if (defaultFeeBps !== requestedFeeBps) {
    blockers.push("REQUESTED_FEE_DIFFERS_FROM_DEFAULT: review an existing preset or explicitly agreed fee; never automatically increase request/cap");
  }
  if ((await c.client.getBlock({ blockNumber: c.block.number })).hash !== c.block.hash) throw new Error("Discovery block reorganized; discard this result");
  return {
    classification: blockers.length ? "BLOCKED" : "PASSED_THIS_RUN",
    route: existing ? "existing-pool" : "new-pool", blockNumber: c.block.number, blockHash: c.block.hash,
    factory: c.factory, registry: c.registry, requestedFeeBps, factoryDefaultFeeBps: defaultFeeBps,
    existingPool: existing ? preflight.existingPool : null, predictedPool: preflight.predictedPool,
    canCreate: !existing && preflight.ready && !blockers.length,
    readyToReviewExistingLiquidity: existing && !blockers.length,
    state, economics, blockers, signing: false,
    note: "Discovery is not a seed/swap authorization. Review economics, price/depth, funding and a NEW plan. Existing pools must not be created again; no governance changes are made.",
  };
}

export function reviewMarketEconomics(requestedFeeBps: number, maxFeeBps: number, status: number, fees: {
  baseFeeBps: number; currentFeeBps: number; dynamicFee: { enabled: boolean; maxVariableFeeBps: number };
}): string[] {
  int(requestedFeeBps, 0, 1000);
  int(maxFeeBps, 0, 1000);
  int(fees.baseFeeBps, 0, 1000);
  int(fees.currentFeeBps, 0, 1000);
  int(fees.dynamicFee.maxVariableFeeBps, 0, 1000);
  if (typeof fees.dynamicFee.enabled !== "boolean") throw new Error("Unknown dynamic fee capability");
  const blockers: string[] = [];
  if (status !== 0) blockers.push("POOL_NOT_ACTIVE");
  if (fees.baseFeeBps !== requestedFeeBps) blockers.push("EXISTING_POOL_FEE_DIFFERS_FROM_REQUEST: review explicitly; no silent fallback");
  const maximum = fees.baseFeeBps + (fees.dynamicFee.enabled ? fees.dynamicFee.maxVariableFeeBps : 0);
  if (maximum > maxFeeBps || fees.currentFeeBps > maxFeeBps) blockers.push("POOL_TOTAL_FEE_CAP_EXCEEDED");
  return blockers;
}
