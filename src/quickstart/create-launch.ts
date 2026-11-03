/**
 * Standalone V4 launch creation from an existing immutable Config.
 *
 *   AMMORA_CHAIN_ID=91342 AMMORA_PRIVATE_KEY=0x... AMMORA_SEND=1 \
 *     npx tsx create-launch.ts 1 "My Token" MTK ipfs://example/metadata.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  custom,
  type Transport,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildCreateAmmoraV4Launch,
  getAmmoraDeployment,
  giwaSepoliaPermissionless,
  giwaSepoliaAutoRouteDeployment,
  giwaSepoliaAutoRoute,
  resolveAmmoraFinalizedHead,
  giwaSepoliaLegacyNativeCompatibility,
  getAmmoraV4ConfigAtBlock,
  parseAmmoraV4LaunchCreatedReceipt,
  verifyAmmoraDeploymentRuntime,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";

const [configIdText, name, symbol, metadataURI] = process.argv.slice(2);
if (!configIdText || !/^\d+$/u.test(configIdText) || !name || !symbol || !metadataURI) {
  throw new Error("usage: <configId> <name> <symbol> <metadataURI>");
}
if (process.env.AMMORA_SEND !== "1") {
  throw new Error("Refusing to send. Review the inputs, then set AMMORA_SEND=1");
}
const privateKey = process.env.AMMORA_PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/u.test(privateKey)) {
  throw new Error("AMMORA_PRIVATE_KEY must be a 0x-prefixed 32-byte throwaway testnet key");
}

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
const account = privateKeyToAccount(privateKey as Hex);
const client = createPublicClient({ chain, transport: pacedHttp(rpcUrl) });
const actualChainId = await client.getChainId();
if (actualChainId !== chainId) throw new Error(`RPC chain ${actualChainId} does not match configured chain ${chainId}`);
const wallet = createWalletClient({ account, chain, transport: http(rpcUrl, { retryCount: 0 }) });
const contracts = deployment.contracts.launch;
const snapshotBlock = chainId === giwaSepoliaAutoRoute.chainId
  ? await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality)
  : await client.getBlockNumber();

const pinFile = process.env.AMMORA_RUNTIME_PINS_FILE?.trim()
  || new URL("./runtime-pins.giwa.json", import.meta.url);
const catalogPins = readRuntimePins(JSON.parse(readFileSync(pinFile, "utf8")), deployment, generation);
const runtimeCodeHashes = mergeRuntimePins(catalogPins, deployment === giwaSepoliaPermissionless);
await verifyAmmoraDeploymentRuntime(
  client,
  deployment,
  snapshotBlock,
  runtimeCodeHashes,
);
await verifyAmmoraV4CoreAtBlock(client, {
  configRegistry: contracts.configRegistry,
  launchFactory: contracts.factory,
  graduationAdapter: contracts.graduationAdapter,
  feePolicy: contracts.feePolicy,
}, snapshotBlock);
const configId = BigInt(configIdText);
const selected = await getAmmoraV4ConfigAtBlock(
  client,
  contracts.configRegistry,
  configId,
  snapshotBlock,
);
if (!selected.enabled) throw new Error(`Config #${configId} is disabled`);

const tokenDecimals = process.env.AMMORA_TOKEN_DECIMALS
  ? Number(process.env.AMMORA_TOKEN_DECIMALS)
  : selected.config.tokenDecimals;
if (!Number.isInteger(tokenDecimals) || tokenDecimals < 6 || tokenDecimals > 9) {
  throw new Error("AMMORA_TOKEN_DECIMALS must be an integer from 6 to 9");
}
if (tokenDecimals !== selected.config.tokenDecimals) {
  throw new Error(
    `Config #${configId} requires ${selected.config.tokenDecimals} token decimals; `
    + "remove AMMORA_TOKEN_DECIMALS or set it to that value",
  );
}
const transaction = buildCreateAmmoraV4Launch({
  name,
  symbol,
  metadataURI,
  creatorMetadataURI: metadataURI,
  tokenDecimals,
}, configId, selected.config.poolCreationFee);
const balance = await client.getBalance({ address: account.address, blockNumber: snapshotBlock });
if (balance < transaction.value) throw new Error("The signing account cannot cover the creation fee");
await client.call({
  account: account.address,
  to: contracts.factory,
  data: transaction.data,
  value: transaction.value,
  blockNumber: snapshotBlock,
});

const hash = await wallet.sendTransaction({
  account,
  chain,
  to: contracts.factory,
  data: transaction.data,
  value: transaction.value,
});
console.log(`submitted ${hash}`);
const receipt = await client.waitForTransactionReceipt({ hash, retryCount: 0, timeout: 120_000, pollingInterval: 6000, confirmations: chainId === giwaSepoliaAutoRoute.chainId ? 13 : 1 });
if (receipt.status !== "success") throw new Error(`Launch transaction reverted: ${hash}`);
const created = parseAmmoraV4LaunchCreatedReceipt(receipt, contracts.factory);

const atReceipt = async <T>(read: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt < 8) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error(`RPC did not expose receipt block ${receipt.blockNumber}`, { cause: lastError });
};
const [confirmedConfig, tokenCode, curveCode] = await atReceipt(() => Promise.all([
  getAmmoraV4ConfigAtBlock(client, contracts.configRegistry, configId, receipt.blockNumber),
  client.getCode({ address: created.token, blockNumber: receipt.blockNumber }),
  client.getCode({ address: created.curve, blockNumber: receipt.blockNumber }),
]));
if (created.configId !== configId
  || created.configHash !== selected.configHash
  || confirmedConfig.configHash !== selected.configHash
  || !tokenCode || tokenCode === "0x"
  || !curveCode || curveCode === "0x") {
  throw new Error("Receipt, immutable Config and deployed token/curve code did not reconcile");
}

console.log(JSON.stringify({
  chainId,
  slot: deployment.slot,
  hash,
  blockNumber: receipt.blockNumber.toString(),
  creator: created.creator,
  configId: created.configId.toString(),
  configHash: created.configHash,
  token: created.token,
  curve: created.curve,
  protocolVersion: created.protocolVersion,
}, null, 2));
