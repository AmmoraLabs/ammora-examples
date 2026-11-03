import { describePartnerOperationStatusV1, getPartnerSdkGuidanceV2 } from "@ammora-protocol/sdk/partner";
import { createClaimExample } from "./claims.js";
import { fixtureModes, fixtureTransactionHash, type FixtureObservation } from "./fixture.js";
import { isMain, runOffline } from "./runtime.js";

/** The SDK correlates exact calldata, sender, target, runtime and canonical finality.
 * Generic action receipt status is not an independent fee-event/balance payout proof. */
export const previewReconciliation = async (mode: FixtureObservation = "unknown") => {
  if (!fixtureModes.includes(mode)) throw new Error("Unknown synthetic observation");
  const example = await createClaimExample(), prepared = await example.planClaim();
  example.fixture.observe(prepared.plan, mode);
  const receipt = await example.handle.client.reconcileAction(prepared.plan, fixtureTransactionHash, "finalized");
  return { scope: example.fixture.scope, receipt, status: describePartnerOperationStatusV1(receipt, "finalized"),
    guidance: getPartnerSdkGuidanceV2(new Error("untrusted provider text is never displayed"), { phase: "reconcile", submission: "unknown" }),
    payoutVerified: false, amountPaid: null,
    note: "Fixture envelope/finality only. Even finalized execution is not proof of a positive fee payout; require exact module fee events and receipt-block recipient balances. Submitted/unknown/orphaned attempts keep their durable journal reservation and are never resent automatically." };
};
if (isMain(import.meta.url)) void runOffline(() => previewReconciliation((process.argv[2] ?? "unknown") as FixtureObservation));
