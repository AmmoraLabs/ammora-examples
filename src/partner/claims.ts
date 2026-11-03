import type { PartnerSdkHandleV2 } from "@ammora-protocol/sdk/partner";
import type { Address } from "viem";
import { createPartnerFixture, fixtureActors, fixtureToken } from "./fixture.js";
import { createReviewedCatalog } from "./catalog.js";
import { isMain, runOffline } from "./runtime.js";

/** Planning alone does not grant authority. Simulate the exact beneficiary request. */
export const preparePartnerClaim = async (handle: PartnerSdkHandleV2<"custody">, asset: Address, beneficiary: Address) => {
  if (handle.kind !== "pool-rights-v1") throw new Error("Expected pool rights family");
  const plan = await handle.client.planClaim(asset, beneficiary);
  const simulation = await handle.client.simulateAction(plan);
  return { plan, simulation, automaticExecution: false as const, payoutVerified: false as const };
};
export const createClaimExample = async (settings: Parameters<typeof createPartnerFixture>[0] = {}) => {
  const fixture = createPartnerFixture(settings), catalog = createReviewedCatalog([fixture.entry]);
  const request = { purpose: "custody", asset: { kind: "erc20", address: fixtureToken } } as const;
  const selection = catalog.select({ ...request, chainId: "31337", genesisHash: fixture.profile.genesisHash, source: fixture.entry.manifest.source });
  if (selection.status !== "selected") throw new Error("Reviewed custody entry unavailable");
  const handle = catalog.open(selection.reference, request);
  if (handle.kind !== "pool-rights-v1") throw new Error("Expected pool rights family");
  return { fixture, handle, planClaim: (beneficiary: Address = fixtureActors.beneficiary) => preparePartnerClaim(handle, fixtureToken, beneficiary) };
};
export const previewClaim = async () => {
  const example = await createClaimExample();
  return { scope: example.fixture.scope, ...await example.planClaim(),
    note: "Unsigned module custody claim, not an ARL NFT claim or C2 source manual claim. This module binds payout to the claiming beneficiary; no alternate recipient is invented. Simulation proves neither a positive payment nor a real deployment." };
};
if (isMain(import.meta.url)) void runOffline(previewClaim);
