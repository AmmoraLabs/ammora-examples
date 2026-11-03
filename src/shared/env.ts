// Configuration for every example, read from the environment.
//
// Nothing here has a place to paste a private key into source. Examples get copied into
// real projects, and a key pasted into a file is a key that ends up in a commit.
import { config } from "dotenv";
import { createPublicClient, createWalletClient, defineChain, getAddress, http } from "viem";
import type { Account, Address, Chain, PublicClient, WalletClient, Transport } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getAmmoraDeployment, giwaSepoliaPermissionless, giwaSepoliaAutoRouteDeployment, giwaSepoliaAutoRoutePoolProfiles, createAmmoraDeploymentSource, giwaSepoliaAutoRoute, resolveAmmoraFinalizedHead } from "@ammora-protocol/sdk";
import type { AmmoraDeployment } from "@ammora-protocol/sdk";
import { integer } from "./input.js";
import { pacedHttp } from "./rpc.js";

type AmmoraV4Deployment = AmmoraDeployment & {
  readonly contracts: AmmoraDeployment["contracts"] & {
    readonly launch: Extract<
      AmmoraDeployment["contracts"]["launch"],
      { readonly protocolVersion: 4 }
    >;
  };
};

config();

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in. See the README.`,
    );
  }
  return value;
};

/** The reviewed deployment for the configured chain, or a refusal naming why not. */
export const deployment = (): AmmoraDeployment => {
  const chainId = integer(required("AMMORA_CHAIN_ID"), "AMMORA_CHAIN_ID", 1, Number.MAX_SAFE_INTEGER);
  const generation = process.env.AMMORA_GIWA_GENERATION?.trim() || "legacy";
  if (!["legacy", "auto-route"].includes(generation)) throw new Error("AMMORA_GIWA_GENERATION must be legacy or auto-route");
  if (chainId !== 91342 && generation !== "legacy") throw new Error("auto-route generation is reviewed for GIWA only");
  const found = chainId === 91342
    ? generation === "auto-route" ? giwaSepoliaAutoRouteDeployment : giwaSepoliaPermissionless
    : getAmmoraDeployment(chainId);
  if (!found) {
    throw new Error(
      `chain ${chainId} has no reviewed Ammora deployment. The SDK ships the catalog; `
      + "pick a chain that appears in it.",
    );
  }
  return found;
};

/** Explicit source prevents SDK 0.3.0 from silently selecting its historical V3 default. */
export const clientOptions = () => {
  const target = deployment();
  return { deploymentSource: createAmmoraDeploymentSource([target]),
    ...(target === giwaSepoliaAutoRouteDeployment ? { factoryProfiles: giwaSepoliaAutoRoutePoolProfiles } : {}),
  };
};

/** Refuses legacy launch generations before a V4 example constructs calldata. */
export const v4Deployment = (): AmmoraV4Deployment => {
  const target = deployment();
  if (target.contracts.launch.protocolVersion !== 4) {
    throw new Error(
      `deployment ${target.slot} uses launch protocol V${target.contracts.launch.protocolVersion}; `
      + "these public launch examples require Ammora V4",
    );
  }
  return target as AmmoraV4Deployment;
};

const rpcUrl = (target: AmmoraDeployment): string => {
  const override = process.env.AMMORA_RPC_URL?.trim();
  const fallback = target.chain.rpcUrls[0];
  if (override) return override;
  if (!fallback) throw new Error(`chain ${target.chain.id} records no RPC URL; set AMMORA_RPC_URL`);
  return fallback;
};

export const chain = (): Chain => {
  const target = deployment();
  return defineChain({
    id: target.chain.id,
    name: target.chain.name,
    nativeCurrency: target.chain.nativeCurrency,
    rpcUrls: { default: { http: [rpcUrl(target)] } },
    ...(target.chain.blockExplorerUrl
      ? { blockExplorers: { default: { name: "Explorer", url: target.chain.blockExplorerUrl } } }
      : {}),
  });
};

/** Serialize read calls on shared public RPCs; never retry implicitly. */
export const reader = async (transport: Transport = pacedHttp()): Promise<PublicClient> => {
  const configured = chain();
  const client: PublicClient = createPublicClient({ chain: configured, transport });
  // client.chain is configuration, not evidence of the RPC's actual chain.
  const actualChainId = await client.getChainId();
  if (actualChainId !== configured.id) {
    throw new Error(`RPC chain ${actualChainId} does not match AMMORA_CHAIN_ID ${configured.id}`);
  }
  return client;
};

/** Select a reviewed snapshot, or explicitly bind a dependent read to a successful receipt. */
export const readBlock = async (client: PublicClient) => {
  if (client.chain?.id !== giwaSepoliaAutoRoute.chainId) {
    throw new Error("No reviewed read-snapshot finality policy for this chain");
  }
  const receiptHash = process.env.AMMORA_READ_RECEIPT?.trim();
  if (receiptHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(receiptHash)) throw new Error("AMMORA_READ_RECEIPT must be a transaction hash");
    const receipt = await client.getTransactionReceipt({ hash: receiptHash as `0x${string}` });
    if (receipt.status !== "success") throw new Error("AMMORA_READ_RECEIPT reverted; refusing its dependent read");
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    if (block.hash !== receipt.blockHash) throw new Error("AMMORA_READ_RECEIPT is not in the canonical block; reconcile before continuing");
    return { ...block, snapshot: { kind: "receipt" as const, transactionHash: receipt.transactionHash, note: "Canonical at read time; no confirmation-depth or L1-finality guarantee." } };
  }
  // Public RPC replicas can announce a latest head before serving its contract state.
  // Choose the reviewed confirmation window before reading; never fall back after failure.
  const blockNumber = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);
  const block = await client.getBlock({ blockNumber });
  return { ...block, snapshot: { kind: "confirmations" as const, policy: giwaSepoliaAutoRoute.finality } };
};

export const requireSend = (): void => {
  if (process.env.AMMORA_SEND !== "1") {
    throw new Error("Refusing to sign or send. Review the inputs, then set AMMORA_SEND=1");
  }
};

/**
 * Signing client. Only the examples that send a transaction call this, so a reader can run
 * the rest of the repository without ever supplying a key.
 */
export const signer = (): { wallet: WalletClient; account: Account } => {
  requireSend();
  const key = required("AMMORA_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("AMMORA_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string");
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  return { account, wallet: createWalletClient({ account, chain: chain(), transport: http(undefined, { retryCount: 0 }) }) };
};

/** An address argument, from the environment or the command line. */
export const address = (name: string, positional?: string): Address => {
  const value = (positional ?? process.env[name])?.trim();
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x address. Pass it as an argument or set it in .env`);
  }
  // Command-line addresses are often copied with arbitrary mixed casing. viem treats a
  // mixed-case value as checksummed and rejects it when even one letter has the wrong
  // case. Normalize the bytes first, then return the canonical EIP-55 representation.
  // This changes no address bits and still rejects malformed lengths and characters.
  return getAddress(value.toLowerCase());
};

export const explorerLink = (hash: string): string => {
  const base = deployment().chain.blockExplorerUrl;
  return base ? `${base}/tx/${hash}` : hash;
};
