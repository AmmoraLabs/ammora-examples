import { createPartnerFixture } from "./fixture.js";
import { createReviewedCatalog } from "./catalog.js";
import { isMain, runOffline } from "./runtime.js";

export const previewManualOnboarding = async () => {
  const fixture = createPartnerFixture(), catalog = createReviewedCatalog([fixture.entry]);
  const request = { purpose: "setup" } as const;
  const selection = catalog.select({ ...request, chainId: "31337", genesisHash: fixture.profile.genesisHash, source: fixture.entry.manifest.source });
  if (selection.status !== "selected") throw new Error("Reviewed setup entry unavailable");
  const handle = catalog.open(selection.reference, request);
  if (handle.kind !== "pool-rights-v1") throw new Error("Expected pool rights family");
  const plan = await handle.client.planOnboarding("C2");
  return { scope: fixture.scope, plan, rpcReads: fixture.calls.length,
    note: "C2 preserves the original beneficiary's fees. For real C1/C3 onboarding call planOnboarding with a separately reviewed live profile; all returned role/dependency/timelock steps still require consent and fresh simulation." };
};
if (isMain(import.meta.url)) void runOffline(previewManualOnboarding);
