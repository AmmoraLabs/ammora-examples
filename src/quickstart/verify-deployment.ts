/**
 * Standalone read-only trust-root check.
 *
 * Copy this file into a project, install @ammora-protocol/sdk, viem and dotenv, then run:
 *   AMMORA_CHAIN_ID=91342 npx tsx verify-deployment.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { custom, type Transport, createPublicClient, defineChain, http, type Hex } from "viem";
import {
  checkContractVerification,
  getAmmoraDeployment,
  giwaSepoliaPermissionless,
  giwaSepoliaAutoRouteDeployment,
  giwaSepoliaAutoRoute,
  resolveAmmoraFinalizedHead,
  giwaSepoliaLegacyNativeCompatibility,
  verifyAmmoraDeploymentRuntime,
} from "@ammora-protocol/sdk";

/** Decode reviewed local pins for exactly the selected SDK deployment. */
export const readRuntimePins = (
  snapshot: unknown,
  target: { readonly chain: { readonly id: number }; readonly slot: string; readonly sourceCommit: string; readonly contracts: object },
  generation: string,
): Record<string, Hex> => {
  const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a reviewed runtime-pin object");
    return value as Record<string, unknown>;
  };
  const root = object(snapshot);
  const profile = object(object(root.deployments)[generation]);
  if (root.schemaVersion !== 1 || root.chainId !== String(target.chain.id)
    || profile.slot !== target.slot || profile.sourceCommit !== target.sourceCommit) {
    throw new Error("Runtime-pin snapshot does not match the selected chain and SDK deployment");
  }
  const pins: Record<string, Hex> = {};
  for (const [address, hash] of Object.entries(object(profile.runtimeCodeHashes))) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new Error("Malformed reviewed runtime pin");
    }
    const key = address.toLowerCase();
    if (pins[key] && pins[key]!.toLowerCase() !== hash.toLowerCase()) throw new Error("Conflicting reviewed runtime pins");
    pins[key] = hash as Hex;
  }
  const addresses = (value: unknown): string[] => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? [value.toLowerCase()] : value && typeof value === "object" ? Object.values(value).flatMap(addresses) : [];
  for (const address of addresses(target.contracts)) {
    if (!pins[address]) throw new Error(`Missing reviewed runtime pin for ${address}`);
  }
  return pins;
};

/** Keep SDK-reviewed legacy compatibility pins; never derive expected hashes from live code. */
export const mergeRuntimePins = (
  reviewedPins: Record<string, Hex>,
  legacyGiwa: boolean,
): Record<string, Hex> => {
  const pins: Record<string, Hex> = {};
  for (const [address, hash] of Object.entries(reviewedPins)) {
    const key = address.toLowerCase();
    if (pins[key] && pins[key]!.toLowerCase() !== hash.toLowerCase()) throw new Error(`Conflicting runtime pins for ${address}`);
    pins[key] = hash;
  }
  if (legacyGiwa) {
    const compat = giwaSepoliaLegacyNativeCompatibility;
    for (const [address, expected] of [
      [compat.executionRegistry, compat.executionRegistryRuntimeCodeHash],
      [compat.nativeRouter, compat.nativeRouterRuntimeCodeHash],
    ] as const) {
      const key = address.toLowerCase();
      if (pins[key] && pins[key]!.toLowerCase() !== expected.toLowerCase()) throw new Error(`Catalog conflicts with SDK runtime pin for ${address}`);
      pins[key] = expected;
    }
  }
  return pins;
};

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

const pinFile = process.env.AMMORA_RUNTIME_PINS_FILE?.trim()
  || new URL("./runtime-pins.giwa.json", import.meta.url);
const catalogPins = readRuntimePins(JSON.parse(readFileSync(pinFile, "utf8")), deployment, generation);
const runtimeCodeHashes = mergeRuntimePins(catalogPins, deployment === giwaSepoliaPermissionless);

const blockNumber = chainId === giwaSepoliaAutoRoute.chainId
  ? await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality)
  : await client.getBlockNumber();
const runtime = await verifyAmmoraDeploymentRuntime(
  client,
  deployment,
  blockNumber,
  runtimeCodeHashes,
);
const provenance = deployment.explorerVerification;
// SDK 0.3.0's named auto-route profile lacks explorer-manifest metadata. Keep
// all four source-verification checks: derive immutable implementation addresses
// from the factory whose exact runtime was authenticated above, never guess them.
const explorerTargets = deployment === giwaSepoliaAutoRouteDeployment
  ? {
      factory: deployment.contracts.launch.factory,
      registry: deployment.contracts.launch.configRegistry,
      tokenImplementation: await client.readContract({ address: deployment.contracts.launch.factory, abi: [{ type: "function", name: "tokenImplementation", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }], functionName: "tokenImplementation", blockNumber }),
      curveImplementation: await client.readContract({ address: deployment.contracts.launch.factory, abi: [{ type: "function", name: "curveImplementation", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }], functionName: "curveImplementation", blockNumber }),
    }
  : (() => {
      if (!provenance || provenance.explorerVerificationStatus !== "verified") throw new Error("The selected deployment does not publish a verified Explorer manifest");
      return { factory: provenance.factory, registry: provenance.registry, tokenImplementation: provenance.tokenImplementation, curveImplementation: provenance.curveImplementation };
    })();

const explorer = await Promise.all(Object.entries(explorerTargets).map(async ([name, address]) => {
  const status = await checkContractVerification(address);
  if (!status.isIndexed || !status.isContract || !status.isVerified) {
    throw new Error(`${name} ${address} is not source verified in Explorer`);
  }
  return { name, address, contractName: status.contractName };
}));

console.log(JSON.stringify({
  chainId,
  slot: deployment.slot,
  protocolVersion: deployment.contracts.launch.protocolVersion,
  sourceCommit: deployment.sourceCommit,
  blockNumber: blockNumber.toString(),
  runtimeContractsVerified: runtime.contracts.length,
  explorer,
  verificationManifestUrl: provenance?.verificationManifestUrl ?? null,
  implementationIdentitySource: deployment === giwaSepoliaAutoRouteDeployment ? "Immutable getters on runtime-authenticated factory" : "SDK explorer manifest",
}, null, 2));
