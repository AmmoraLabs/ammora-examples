/** Read-only explicit GIWA auto-route generation check. It does not change the default deployment. */
import { giwaSepoliaAutoRoute, resolveAmmoraFinalizedHead, giwaSepoliaAutoRouteDeployment, verifyAmmoraRouteDeploymentRuntime, ammoraRouteDeploymentVenues, resolveAmmoraVenueObservation } from "@ammora-protocol/sdk";
import { deployment, reader } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";

main(async () => {
  if (deployment().chain.id !== 91342) throw new Error("This opt-in generation is reviewed for GIWA Sepolia only");
  const client = await reader();
  const blockNumber = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);
  const runtime = await verifyAmmoraRouteDeploymentRuntime(client, giwaSepoliaAutoRoute, blockNumber);
  const venues = ammoraRouteDeploymentVenues(giwaSepoliaAutoRoute).map(venue => ({ venueId: venue.id, ...resolveAmmoraVenueObservation(giwaSepoliaAutoRoute, runtime, venue.id, blockNumber) }));
  printJson({ chainId: 91342, slot: giwaSepoliaAutoRoute.slot, blockNumber, launch: giwaSepoliaAutoRouteDeployment.contracts.launch, capabilities: giwaSepoliaAutoRoute.capabilities, venues, venuesDisabled: runtime?.venuesDisabled ?? {}, status: "VERIFIED_AT_BLOCK", note: "Individual curves still require finalized registry registration; verification is not a registration SLA." });
});
