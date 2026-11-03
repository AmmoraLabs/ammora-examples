/**
 * Standalone read-only Aggregation Router readiness check.
 *
 * The official catalog is the activation boundary. A testnet canary address is
 * not permission to patch an application catalog or request a wallet signature.
 *
 * Copy this file into a project, install @ammora-protocol/sdk, viem and dotenv,
 * then run:
 *   AMMORA_CHAIN_ID=91342 npx tsx check-aggregation.ts
 */
import "dotenv/config";
import { createPublicClient, defineChain, http, custom, type Transport } from "viem";
import {
  giwaSepoliaAutoRoute,
  giwaSepoliaAutoRouteDeployment,
  verifyAmmoraRouteDeploymentRuntime,
  resolveAmmoraFinalizedHead,
  resolveAmmoraVenueAvailabilities,
} from "@ammora-protocol/sdk";


/** Serialize public RPC calls, including SDK Promise.all reads. Batching alone cannot
 * prevent rate limits that count each JSON-RPC method. No automatic retries or writes. */
export const pacedHttp = (url?: string, intervalMs = Number(process.env.AMMORA_RPC_INTERVAL_MS ?? "600")): Transport => {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 0 || intervalMs > 60_000) {
    throw new Error("AMMORA_RPC_INTERVAL_MS must be an integer from 0 to 60000");
  }
  // Keep the queue outside transport initialization: clients may instantiate it again.
  let tail: Promise<unknown> = Promise.resolve();
  let nextStart = 0;
  return (parameters) => {
    const base = http(url, { retryCount: 0 })(parameters);
    return custom({
      request: (args) => {
        const result = tail.then(async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextStart - Date.now())));
          try { return await base.request(args); }
          finally { nextStart = Date.now() + intervalMs; }
        });
        tail = result.catch(() => undefined);
        return result;
      },
    }, { retryCount: 0 })(parameters);
  };
};

const chainId = Number(process.env.AMMORA_CHAIN_ID ?? "91342");
if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("AMMORA_CHAIN_ID must be a positive safe integer");
if (chainId !== 91342) throw new Error("This example targets the published GIWA Sepolia auto-route generation");
// SDK 0.3.0 retains the old route catalog for compatibility. Use its complete,
// separately reviewed current generation rather than patching a legacy address.
const core = giwaSepoliaAutoRouteDeployment;
const route = giwaSepoliaAutoRoute;

const rpcUrl = process.env.AMMORA_RPC_URL?.trim() || route.rpcUrls[0];
if (!rpcUrl) throw new Error("The route catalog has no public RPC; set AMMORA_RPC_URL");
const chain = defineChain({
  id: route.chainId,
  name: route.chainName,
  nativeCurrency: route.nativeCurrency,
  rpcUrls: { default: { http: [rpcUrl] } },
});
const client = createPublicClient({ chain, transport: pacedHttp(rpcUrl) });
const actualChainId = await client.getChainId();
if (actualChainId !== chainId) throw new Error(`RPC chain ${actualChainId} does not match configured chain ${chainId}`);
const blockNumber = await resolveAmmoraFinalizedHead([client], route.finality);

const enabled = route.capabilities.atomicMultiHop
  && route.aggregationRouter !== null
  && route.aggregationExecutionRegistry !== null;
let runtimeStatus: Awaited<ReturnType<typeof verifyAmmoraRouteDeploymentRuntime>> = null;
if (enabled) {
  // This verifies router/registry/policy/WETH/factory/implementation bytecode,
  // frozen registrations, separated owner/guardian roles and enabled factories
  // at one immutable block before an application exposes aggregation.
  runtimeStatus = await verifyAmmoraRouteDeploymentRuntime(client, route, blockNumber);
}

const result = {
  chainId,
  coreSlot: core.slot,
  routeSlot: route.slot,
  blockNumber: blockNumber.toString(),
  directExactInput: route.capabilities.directExactInput,
  nativeInput: route.capabilities.nativeInput,
  atomicMultiHop: enabled,
  venues: resolveAmmoraVenueAvailabilities(route, runtimeStatus),
  venuesDisabled: runtimeStatus?.venuesDisabled ?? {},
  maxHops: route.capabilities.maxHops,
  aggregationRouter: route.aggregationRouter,
  aggregationExecutionRegistry: route.aggregationExecutionRegistry,
  status: enabled ? "ENABLED_AND_VERIFIED" : "DISABLED_BY_OFFICIAL_CATALOG",
  nextGate: enabled ? null : "Reviewed official catalog activation and runtime verification",
};
console.log(JSON.stringify(result, null, 2));

if (process.env.AMMORA_REQUIRE_AGGREGATION === "1" && !enabled) {
  throw new Error("Aggregation is not enabled in the official catalog");
}
