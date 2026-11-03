/**
 * Standalone reviewed exact-input swap.
 *
 *   AMMORA_CHAIN_ID=91342 AMMORA_PRIVATE_KEY=0x... AMMORA_SEND=1 \
 *     npx tsx safe-swap.ts <almm|concentrated|compounding|dbc> <pool> <tokenIn> <amountIn> [native]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  custom,
  encodeFunctionData, zeroAddress, type Address, type PublicClient,
  type Transport,
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  AmmoraSwapClient, PreparedExactInputSwap, AMMORA_FEE_POLICY_VERSION, AmmoraV4LaunchCurveClient,
  ammoraLaunchFactoryV4Abi, ammoraLaunchPoolV4Abi, classifyAmmoraV4ExactInputFill, verifyAmmoraV4CoreAtBlock,
  getAmmoraDeployment,
  giwaSepoliaPermissionless,
  giwaSepoliaAutoRouteDeployment, giwaSepoliaAutoRoutePoolProfiles,
  giwaSepoliaAutoRoute,
  resolveAmmoraFinalizedHead,
  giwaSepoliaLegacyNativeCompatibility,
  type AmmoraSwapModel,
  verifyAmmoraDeploymentRuntime,
} from "@ammora-protocol/sdk";

/** Explicit-block V4 planning for SDK 0.3.0, whose convenience swap planner selects
 * latest internally. Authentication and quotes stay at the caller's reviewed block;
 * execution must still simulate against current state and enforce minimum output. */
export const planCurveAtBlock = async (
  client: PublicClient,
  core: { configRegistry: Address; launchFactory: Address; graduationAdapter: Address; feePolicy: Address },
  curve: Address,
  parameters: { blockNumber: bigint; tokenIn: Address; amountIn: bigint; recipient: Address; deadline: bigint; slippageBps: number; graduationBoundary?: boolean },
) => {
  if (parameters.amountIn <= 0n || !Number.isSafeInteger(parameters.slippageBps) || parameters.slippageBps < 0 || parameters.slippageBps > 1000) throw new Error("positive input and slippage from 0 to 1000 bps required");
  const blockNumber = parameters.blockNumber;
  await verifyAmmoraV4CoreAtBlock(client, core, blockNumber);
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, core);
  const state = await sdk.getStateAtBlock(blockNumber);
  const factoryToken = await client.readContract({ address: core.launchFactory, abi: ammoraLaunchFactoryV4Abi, functionName: "tokenForCurve", args: [curve], blockNumber });
  if (factoryToken === zeroAddress || factoryToken.toLowerCase() !== state.baseToken.toLowerCase()
    || state.feePolicy.toLowerCase() !== core.feePolicy.toLowerCase()
    || state.feePolicyVersion !== AMMORA_FEE_POLICY_VERSION) throw new Error("curve is not bound to the reviewed V4 factory and fee policy");
  if (state.status !== 1) throw new Error(`Curve status ${state.status} is not active`);
  const baseForQuote = parameters.tokenIn.toLowerCase() === state.baseToken.toLowerCase();
  if (!baseForQuote && parameters.tokenIn.toLowerCase() !== state.quoteToken.toLowerCase()) throw new Error("tokenIn is not a curve asset");
  const quote = await sdk.quoteExactInputAtBlock(parameters.amountIn, baseForQuote, blockNumber);
  const fill = classifyAmmoraV4ExactInputFill(quote, baseForQuote);
  const boundary = parameters.graduationBoundary === true;
  if (boundary ? fill.kind !== "graduation-boundary" : fill.kind !== "full") throw new Error(`Unexpected ${fill.kind}; ordinary orders must fill in full and graduation buys must reach the boundary`);
  const minimumAmountOut = quote.amountOut * BigInt(10_000 - parameters.slippageBps) / 10_000n;
  if (minimumAmountOut === 0n) throw new Error("minimum output rounds to zero");
  return {
    state, quote: { ...quote, minimumAmountOut }, fill, baseForQuote,
    tokenOut: baseForQuote ? state.quoteToken : state.baseToken,
    transaction: { to: curve, data: encodeFunctionData({ abi: ammoraLaunchPoolV4Abi, functionName: "swapExactInput", args: [parameters.amountIn, minimumAmountOut, baseForQuote, boundary, parameters.recipient, parameters.deadline] }) },
    approvalRequirements: [{ token: parameters.tokenIn, spender: curve, amount: parameters.amountIn }],
  };
};

const [modelText, poolText, tokenInText, amountText, inputAssetText] = process.argv.slice(2);
const models = new Set<AmmoraSwapModel>(["almm", "concentrated", "compounding", "dbc"]);
if (!models.has(modelText as AmmoraSwapModel) || !poolText || !tokenInText || !amountText) {
  throw new Error("usage: <almm|concentrated|compounding|dbc> <pool> <tokenIn> <amountIn> [native]");
}
if (inputAssetText && inputAssetText !== "native") throw new Error("optional fifth argument must be native");
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
const pool = getAddress(poolText.toLowerCase());
const tokenIn = getAddress(tokenInText.toLowerCase());
const [decimals, symbol] = await Promise.all([
  client.readContract({ address: tokenIn, abi: erc20Abi, functionName: "decimals" }),
  client.readContract({ address: tokenIn, abi: erc20Abi, functionName: "symbol" }),
]);
if (!/^\d+(\.\d+)?$/.test(amountText) || (amountText.split(".")[1]?.length ?? 0) > Number(decimals)) {
  throw new Error(`amountIn must have at most ${decimals} fractional digits and be non-negative`);
}
const amountIn = parseUnits(amountText, Number(decimals));
if (amountIn <= 0n) throw new Error("amountIn must be positive");
const slippageBps = Number(process.env.AMMORA_SLIPPAGE_BPS ?? "50");
if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10000) throw new Error("slippage must be an integer from 0 to 9999");
const core = { configRegistry: deployment.contracts.launch.configRegistry, launchFactory: deployment.contracts.launch.factory, graduationAdapter: deployment.contracts.launch.protocolVersion === 4 ? deployment.contracts.launch.graduationAdapter : zeroAddress, feePolicy: deployment.contracts.launch.feePolicy ?? zeroAddress };
if (inputAssetText === "native" && modelText === "dbc" && generation === "auto-route") {
  const [kind, enabled] = await client.readContract({ address: deployment.contracts.routers.executionRegistry, abi: [{ type: "function", name: "factoryConfig", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint8" }, { type: "bool" }] }], functionName: "factoryConfig", args: [core.launchFactory], blockNumber: snapshotBlock });
  if (kind !== 1 || !enabled) throw new Error("This generation's native execution registry does not enable its launch factory. No transaction sent. Use explicitly funded WETH input (omit native), or request a separately reviewed deployment configuration change.");
}
// Keep the real RPC head intact. Only receipt waiting enforces the reviewed
// confirmation window before the SDK reads a dependency's receipt-block state.
const executionClient = chainId === giwaSepoliaAutoRoute.chainId ? client.extend(() => ({
  waitForTransactionReceipt: (request: Parameters<typeof client.waitForTransactionReceipt>[0]) => client.waitForTransactionReceipt({ ...request, confirmations: 13, retryCount: 0, timeout: 120_000, pollingInterval: 6000 }),
})) : client;
const swaps = await AmmoraSwapClient.create(executionClient, { deploymentCatalog: { [chainId]: deployment }, ...(deployment === giwaSepoliaAutoRouteDeployment ? { factoryProfiles: giwaSepoliaAutoRoutePoolProfiles } : {}) });
const prepared = modelText === "dbc" && inputAssetText !== "native" && deployment.contracts.launch.protocolVersion === 4
  ? await PreparedExactInputSwap.create({ client: executionClient, chainId, payer: account.address, quoteTtlMs: 30_000, createPlan: async () => {
      if (chainId !== giwaSepoliaAutoRoute.chainId) throw new Error("No reviewed explicit-block curve quote policy for this chain");
      const blockNumber = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);
      const block = await client.getBlock({ blockNumber });
      const plan = await planCurveAtBlock(client, core, pool, { blockNumber, tokenIn, amountIn, recipient: account.address, deadline: block.timestamp + 20n * 60n, slippageBps });
      return { transaction: plan.transaction, approvalRequirements: plan.approvalRequirements, quoteBlockNumber: blockNumber, quote: {
        model: "dbc", pool, tokenIn, inputAsset: "erc20", tokenOut: plan.tokenOut, amountIn,
        fillableAmountIn: plan.quote.amountIn, remainderAmountIn: plan.quote.amountLeft,
        expectedAmountOut: plan.quote.amountOut, minimumAmountOut: plan.quote.minimumAmountOut,
        feeAmount: plan.quote.fee, feeToken: null, priceImpactBps: null, recipient: account.address,
        details: { snapshotBlock: blockNumber, snapshotHash: block.hash, policy: giwaSepoliaAutoRoute.finality, note: "Confirmed snapshot quote, not a latest execution-price guarantee; current-state simulation and minimum output remain mandatory.", quote: plan.quote },
      } };
    } })
  : (modelText === "concentrated" || modelText === "compounding") && chainId === giwaSepoliaAutoRoute.chainId
    ? await PreparedExactInputSwap.create({ client: executionClient, chainId, payer: account.address, quoteTtlMs: 30_000, createPlan: async () => {
        const quoteBlockNumber = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);
        const planned = await swaps.prepareExactIn({ ...{
  model: modelText as AmmoraSwapModel,
  pool,
  tokenIn,
  inputAsset: inputAssetText === "native" ? "native" : "erc20",
  amountIn,
  payer: account.address,
  recipient: account.address,
  slippageBps,
  executionMode: "direct-wallet",
}, quoteBlockNumber });
        return { transaction: planned.transaction, approvalRequirements: planned.approvalRequirements, quoteBlockNumber: planned.quote.quoteBlockNumber, quote: planned.quote };
      } })
  : await swaps.prepareExactIn({
  model: modelText as AmmoraSwapModel,
  pool,
  tokenIn,
  inputAsset: inputAssetText === "native" ? "native" : "erc20",
  amountIn,
  payer: account.address,
  recipient: account.address,
  slippageBps,
  executionMode: "direct-wallet",
});
const [outputDecimals, outputSymbol] = await Promise.all([
  client.readContract({ address: prepared.quote.tokenOut, abi: erc20Abi, functionName: "decimals" }),
  client.readContract({ address: prepared.quote.tokenOut, abi: erc20Abi, functionName: "symbol" }),
]);
console.log(`Pay      ${formatUnits(amountIn, Number(decimals))} ${inputAssetText === "native" ? "ETH" : symbol}`);
console.log(`Expected ${formatUnits(prepared.quote.expectedAmountOut, Number(outputDecimals))} ${outputSymbol}`);
console.log(`Minimum  ${formatUnits(prepared.quote.minimumAmountOut, Number(outputDecimals))} ${outputSymbol}`);
console.log(`Quote at block ${prepared.quote.quoteBlockNumber}`);

const result = await prepared.execute(wallet, {
  onStatus: (status) => console.log(`Status   ${JSON.stringify(status, (_, value) => typeof value === "bigint" ? value.toString() : value)}`),
});
if (result.amountReceived === null) {
  throw new Error("Swap succeeded but receipt-block output reconciliation was unavailable");
}
console.log(JSON.stringify({
  chainId,
  slot: deployment.slot,
  hash: result.hash,
  approvalHashes: result.approvalHashes,
  blockNumber: result.receipt.blockNumber.toString(),
  balanceVerifiedAtBlock: result.balanceVerifiedAtBlock?.toString() ?? null,
  tokenIn,
  tokenOut: prepared.quote.tokenOut,
  amountIn: amountIn.toString(),
  expectedAmountOut: prepared.quote.expectedAmountOut.toString(),
  minimumAmountOut: prepared.quote.minimumAmountOut.toString(),
  amountReceived: result.amountReceived.toString(),
}, null, 2));
