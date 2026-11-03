/**
 * Standalone read-only V4 Config listing at one explicit block.
 *
 *   AMMORA_CHAIN_ID=91342 npx tsx list-configs.ts 10
 */
import "dotenv/config";
import { custom, type Transport, createPublicClient, defineChain, http } from "viem";
import {
  getAmmoraDeployment,
  giwaSepoliaPermissionless,
  giwaSepoliaAutoRouteDeployment,
  giwaSepoliaAutoRoute,
  resolveAmmoraFinalizedHead,
  getAmmoraV4ConfigAtBlock,
  getAmmoraV4NextConfigId,
  verifyAmmoraV4CoreAtBlock,
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
// Select a complete SDK deployment; Config IDs and launch addresses are generation-specific.
const generation = process.env.AMMORA_GIWA_GENERATION?.trim() || "legacy";
if (!["legacy", "auto-route"].includes(generation)) throw new Error("AMMORA_GIWA_GENERATION must be legacy or auto-route");
if (chainId !== 91342 && generation !== "legacy") throw new Error("auto-route generation is reviewed for GIWA only");
const deployment = chainId === 91342
  ? generation === "auto-route" ? giwaSepoliaAutoRouteDeployment : giwaSepoliaPermissionless
  : getAmmoraDeployment(chainId);
if (!deployment) throw new Error(`No reviewed Ammora deployment is cataloged for chain ${chainId}`);
if (deployment.contracts.launch.protocolVersion !== 4) {
  throw new Error(`The selected deployment uses V${deployment.contracts.launch.protocolVersion}, not V4`);
}
const rpcUrl = process.env.AMMORA_RPC_URL?.trim() || deployment.chain.rpcUrls[0];
if (!rpcUrl) throw new Error("The catalog has no public RPC; set AMMORA_RPC_URL");
const chain = defineChain({
  id: deployment.chain.id,
  name: deployment.chain.name,
  nativeCurrency: deployment.chain.nativeCurrency,
  rpcUrls: { default: { http: [rpcUrl] } },
});
const client = createPublicClient({ chain, transport: pacedHttp(rpcUrl) });
const actualChainId = await client.getChainId();
if (actualChainId !== chainId) throw new Error(`RPC chain ${actualChainId} does not match configured chain ${chainId}`);
const contracts = deployment.contracts.launch;
// Borrow only the same chain's reviewed finality strategy, not its route contracts.
if (chainId !== giwaSepoliaAutoRoute.chainId) throw new Error("No reviewed read-snapshot finality policy for this chain");
const blockNumber = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);

await verifyAmmoraV4CoreAtBlock(client, {
  configRegistry: contracts.configRegistry,
  launchFactory: contracts.factory,
  graduationAdapter: contracts.graduationAdapter,
  feePolicy: contracts.feePolicy,
}, blockNumber);

const requestedLimit = Number(process.argv[2] ?? "10");
if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
  throw new Error("limit must be an integer from 1 to 100");
}
const nextConfigId = await getAmmoraV4NextConfigId(
  client,
  contracts.configRegistry,
  blockNumber,
);
const registeredCount = nextConfigId > 1n ? nextConfigId - 1n : 0n;
const count = Number(registeredCount > BigInt(requestedLimit)
  ? BigInt(requestedLimit)
  : registeredCount);
// Each Config needs seven contract reads. Pace pages on the shared public RPC;
// HTTP batching alone does not reduce providers that count individual eth_calls.
const configs: Awaited<ReturnType<typeof getAmmoraV4ConfigAtBlock>>[] = [];
for (let index = 0; index < count; index++) {
  if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
  configs.push(await getAmmoraV4ConfigAtBlock(
    client, contracts.configRegistry, BigInt(index + 1), blockNumber,
  ));
}

console.log(JSON.stringify({
  chainId,
  slot: deployment.slot,
  registry: contracts.configRegistry,
  blockNumber: blockNumber.toString(),
  nextConfigId: nextConfigId.toString(),
  configs: configs.map((entry) => ({
    configId: entry.configId.toString(),
    enabled: entry.enabled,
    configHash: entry.configHash,
    owner: entry.identity.owner,
    feeClaimer: entry.identity.feeClaimer,
    quoteToken: entry.config.quoteToken,
    migrationMode: entry.config.migrationMode,
    segments: entry.segments.length,
  })),
}, null, 2));
