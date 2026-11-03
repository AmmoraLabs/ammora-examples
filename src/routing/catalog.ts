import {
  giwaSepoliaAutoRoute,
  giwaSepoliaAutoRouteCatalog,
  giwaSepoliaAutoRouteDeployment,
  giwaSepoliaAutoRouteDeploymentCatalog,
  giwaSepoliaAutoRoutePoolProfiles,
} from "@ammora-protocol/sdk";

/** Select the complete published generation, never mix its router with a legacy core. */
export const routeGeneration = (chainId: number) => {
  if (chainId !== 91342) throw new Error("These route examples require the reviewed GIWA Sepolia auto-route generation");
  return {
    core: giwaSepoliaAutoRouteDeployment,
    route: giwaSepoliaAutoRoute,
    routeCatalog: giwaSepoliaAutoRouteCatalog,
    deploymentCatalog: giwaSepoliaAutoRouteDeploymentCatalog,
    factoryProfiles: giwaSepoliaAutoRoutePoolProfiles,
  };
};
