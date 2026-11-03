import { createPartnerSdkCatalogV2, type PartnerSdkEntryV2 } from "@ammora-protocol/sdk/partner";
import { createPartnerFixture, fixtureToken } from "./fixture.js";
import { isMain, runOffline } from "./runtime.js";

/** Entries must come from installed, locally reviewed SDK drivers, never parsed remote JSON. */
export const createReviewedCatalog = (entries: readonly PartnerSdkEntryV2[]) => createPartnerSdkCatalogV2({ entries });
export const previewCatalog = () => {
  const fixture = createPartnerFixture(), catalog = createReviewedCatalog([fixture.entry]);
  const query = { chainId: String(fixture.profile.chainId), genesisHash: fixture.profile.genesisHash,
    source: fixture.entry.manifest.source, purpose: "trade", route: fixture.route } as const;
  return { scope: fixture.scope, installed: catalog.list(), selected: catalog.diagnose(query),
    unsupported: catalog.diagnose({ ...query, route: { ...fixture.route, mode: "exact-output" } }),
    custody: catalog.select({ chainId: query.chainId, genesisHash: query.genesisHash, source: query.source, purpose: "custody", asset: { kind: "erc20", address: fixtureToken } }),
    note: "Selection is local capability matching, never live execution approval.", rpcReads: fixture.calls.length };
};
if (isMain(import.meta.url)) void runOffline(previewCatalog);
