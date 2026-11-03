import { describePartnerCostsV2, describePoolRightsQuoteCostsV2,
  type PartnerSdkHandleV2, type PoolRightsIntentV1 } from "@ammora-protocol/sdk/partner";
import type { Address } from "viem";
import { fixtureToken } from "./fixture.js";
import { isMain, runOffline } from "./runtime.js";

/** Real quotes use an already reviewed trade handle and bounded injected read transport.
 * No signature/approval/submission is performed here. */
export const quoteReviewedPool = async (handle: PartnerSdkHandleV2<"trade">, intent: PoolRightsIntentV1) => {
  if (handle.kind !== "pool-rights-v1") throw new Error("Expected pool rights family");
  const plan = await handle.client.quote(intent);
  return { plan, costs: describePoolRightsQuoteCostsV2(plan), executionApproved: false as const };
};

/** Offline cost display only: no fabricated executable trade plan or payout assertion. */
export const previewQuoteCosts = (asset: Address = fixtureToken, creatorFee = 1000n, treasuryFee = 200n) => ({
  scope: "SYNTHETIC_OFFLINE", costs: describePartnerCostsV2([
    { id: "creator", asset: { kind: "erc20", address: asset }, category: "eligible-creator", eligible: true, amount: creatorFee, ammora: null, partner: null },
    { id: "treasury", asset: { kind: "erc20", address: asset }, category: "treasury", eligible: false, amount: treasuryFee, ammora: null, partner: null },
    { id: "gas", asset: { kind: "native" }, category: "gas", eligible: false, amount: null, ammora: null, partner: null },
  ], "quote"), note: "A managed quote is not secured revenue or a paid fee. Allocation requires the actual reconciled receipt; unknown native gas stays unknown. Direct LP and C2 original claims are not automatically subject to managed 20:80." });
if (isMain(import.meta.url)) void runOffline(previewQuoteCosts);
