import { readFileSync } from "node:fs";
import { ALMMClient, createAmmoraDeploymentSource, giwaSepoliaAutoRouteDeployment, type AmmoraDeployment } from "@ammora-protocol/sdk";
import { erc20Abi, keccak256, parseAbi, stringToHex, toHex, zeroAddress, type Address, type PublicClient } from "viem";
import { reader, readBlock } from "../../src/shared/env.js";
import { requireResolved, same, addr, hash } from "../../src/stablecoin/manifest.js";
import { atBlock, checkAuthorities, referenceGuard, priceGuard } from "../../src/stablecoin/context.js";
import type { ALMMFeeClaimOptions } from "./fee-claims-compat.js";
import { getALMMPriceX128FromBinId } from "@ammora-protocol/sdk";
import { unifiedManifest, reviewedCaller } from "./roles.js";
export function selectedProfile() {
  const f = JSON.parse(readFileSync(new URL("./giwa-profile.json", import.meta.url), "utf8"));
  if (f.schemaVersion !== 1 || f.id !== "giwa-almm-unified-v1" || f.chainId !== 91342 || f.feeClaimRoutingVersion !== 1) throw new Error("Select the reviewed GIWA unified profile");
  for (const role of ["deployer", "factory", "manager", "reward", "controller", "registry", "lens", "limitOrderManager", "zapRouter", "oracle", "marketSyncController"]) { addr(f[role]); hash(f.runtimeCodeHashes[f[role].toLowerCase()]); }
  const catalog = giwaSepoliaAutoRouteDeployment;
  const deployment: AmmoraDeployment = { ...catalog, contracts: { ...catalog.contracts,
    liquidityMarketMaker: { deployer: addr(f.deployer), factory: addr(f.factory), positionManager: addr(f.manager), rewardManager: addr(f.reward), binLens: addr(f.lens), limitOrderManager: addr(f.limitOrderManager), zapRouter: addr(f.zapRouter), oracle: addr(f.oracle), marketSyncController: addr(f.marketSyncController) },
    policy: { tokenPolicyRegistry: addr(f.registry) } }, security: { runtimeCodeHashes: f.runtimeCodeHashes } };
  // Scope the new height/pins to ALMM; do not relabel historical Launch factories.
  const normalized = createAmmoraDeploymentSource([deployment]).resolve(91342);
  if (!normalized || !/^[1-9]\d*$/.test(String(f.deploymentBlock))) throw new Error("Missing reviewed ALMM deployment height");
  const options = { deploymentSource: createAmmoraDeploymentSource([{ ...normalized,
    recognized: { ...normalized.recognized, liquidityMarketMakerFactories: [{ address: addr(f.factory), startBlock: BigInt(f.deploymentBlock), version: f.id, runtimeCodeHash: hash(f.runtimeCodeHashes[f.factory.toLowerCase()]) }] },
    runtimeCodeHashes: f.runtimeCodeHashes,
  }]) };
  const pin = (a: string) => hash(f.runtimeCodeHashes[a.toLowerCase()]);
  const feeOptions: ALMMFeeClaimOptions = { ...options, feeClaimRoutingVersion: 1, binding: { chainId: 91342, factory: addr(f.factory), factoryCodeHash: pin(f.factory), registry: addr(f.registry), registryCodeHash: pin(f.registry), registryAggregation: "unavailable", positionManager: addr(f.manager), positionManagerCodeHash: pin(f.manager), rewardManager: addr(f.reward), rewardManagerCodeHash: pin(f.reward), feeClaimController: addr(f.controller), feeClaimControllerCodeHash: pin(f.controller), binLens: addr(f.lens) } };
  return { f, options, feeOptions };
}
const tokenChecks = parseAbi(["function policy(address) view returns(uint8,bool,bool,bool)", "function paused() view returns(bool)", "function isBlacklisted(address) view returns(bool)", "function factory() view returns(address)", "function isPool(address) view returns(bool)"]);
/** Shared deployment selection is independent of asset identity; every new issuer still supplies reviewed asset evidence. */
export async function unifiedContext(value: unknown, caller: Address, pool?: Address, exposure = false, supplied?: PublicClient) {
  const m = unifiedManifest(value); requireResolved(m);
  if (m.model !== "almm" || m.deployment) throw new Error("Use an ALMM asset manifest without the old synthetic-only deployment selector");
  if (process.env.AMMORA_READ_RECEIPT?.trim()) throw new Error("Explicitly empty AMMORA_READ_RECEIPT for fresh planning");
  if (!reviewedCaller(m, caller)) throw new Error("Caller must be a reviewed liquidity owner, fee owner or fee delegate");
  const { f, options, feeOptions } = selectedProfile(), client = supplied ?? await reader();
  if (await client.getChainId() !== 91342) throw new Error("GIWA chain mismatch");
  const block = await readBlock(client), c = atBlock(client, block.number);
  for (const [address, expected] of Object.entries(f.runtimeCodeHashes) as [Address, string][]) { const code = await c.getCode({ address }); if (!code || code === "0x" || keccak256(code) !== expected) throw new Error("Profile runtime changed: " + address); }
  const forbidden = [zeroAddress, f.factory, f.manager, f.reward, f.controller, f.registry, m.base.address!, m.quote.address!, ...(pool ? [pool] : [])];
  if (forbidden.some(a => same(a, m.roles.payout!))) throw new Error("Unsafe payout");
  for (const asset of [m.base, m.quote]) {
    const token = asset.address!, code = await c.getCode({ address: token });
    if (!code || keccak256(code) !== asset.codeHash || await c.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }) !== asset.decimals) throw new Error("Asset runtime/decimals review invalidated");
    for (const name of ["implementation", "admin", "beacon"]) {
      const slot = toHex(BigInt(keccak256(stringToHex("eip1967.proxy." + name))) - 1n, { size: 32 });
      const actual = await c.getStorageAt({ address: token, slot });
      const expected = asset.proxy.kind === "eip1967" && name !== "beacon" ? (name === "implementation" ? asset.proxy.implementation : asset.proxy.admin ?? zeroAddress) : zeroAddress;
      if (actual && !same("0x" + actual.slice(-40), expected)) throw new Error("Proxy authority/implementation review invalidated");
    }
    if (asset.proxy.kind === "eip1967") { const impl = await c.getCode({ address: asset.proxy.implementation }); if (!impl || keccak256(impl) !== asset.proxy.implementationCodeHash) throw new Error("Implementation runtime changed"); }
    await checkAuthorities(c, asset);
    if (asset.review.pausedGetter && await c.readContract({ address: token, abi: tokenChecks, functionName: "paused" })) throw new Error("Issuer paused");
    if (asset.review.blacklistGetter) for (const who of [caller, m.roles.liquidityOwner!, m.roles.payout!, f.factory, f.manager, f.reward, ...(pool ? [pool] : [])]) if (await c.readContract({ address: token, abi: tokenChecks, functionName: "isBlacklisted", args: [who] })) throw new Error("Issuer blacklist prevents this operation");
    const policy = await c.readContract({ address: f.registry, abi: tokenChecks, functionName: "policy", args: [token] });
    if (exposure && (!policy[1] || ![1, 2].includes(policy[0]))) throw new Error("Token policy does not admit exact-transfer pool assets");
  }
  if (exposure) referenceGuard(m, Number(block.timestamp));
  const sdk = pool ? new ALMMClient(c, pool, addr(f.manager), addr(f.lens), options) : undefined;
  if (pool) { if (!await c.readContract({ address: f.factory, abi: tokenChecks, functionName: "isPool", args: [pool] }) || !same(await c.readContract({ address: pool, abi: tokenChecks, functionName: "factory" }), f.factory)) throw new Error("Unrecognized pool");
    const state = await sdk!.getPoolState(); if (!same(state.baseToken, m.base.address!) || !same(state.quoteToken, m.quote.address!)) throw new Error("Pool pair differs from reviewed manifest");
    if (exposure) { priceGuard(m, getALMMPriceX128FromBinId(state.activeId, state.binStepBps) * 10n ** BigInt(m.base.decimals!) * 10n ** 18n / (2n ** 128n * 10n ** BigInt(m.quote.decimals!))); if (state.currentFeeBps > m.policy.maxFeeBps) throw new Error("Fee cap exceeded"); }
  }
  if ((await client.getBlock({ blockNumber: block.number })).hash !== block.hash) throw new Error("Planning block reorganized");
  return { m, caller, pool, f, client, c, block, sdk, options, feeOptions: { ...feeOptions, blockNumber: block.number } };
}
export type UnifiedContext = Awaited<ReturnType<typeof unifiedContext>>;
