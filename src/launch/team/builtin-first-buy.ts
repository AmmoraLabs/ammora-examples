import * as sdk from "@ammora-protocol/sdk";
import type { AmmoraPortableDeployment, AmmoraPortableLifecyclePlanner } from "@ammora-protocol/sdk";
import type { PublicClient, Address } from "viem";
import { prepareTeamAtomicFirstBuy, type TeamAtomicInput } from "./atomic-policy.js";
import type { TeamRecipientPolicy } from "./policy.js";

type AtomicParameters = Parameters<AmmoraPortableLifecyclePlanner["planAtomicFirstBuy"]>[0] & { blockNumber: bigint };
type AtomicPlan = Awaited<ReturnType<AmmoraPortableLifecyclePlanner["planAtomicFirstBuy"]>>;
export type AtomicCatalogAPI = {
  giwaSepoliaAtomicLaunchDeployment: AmmoraPortableDeployment;
  giwaSepoliaAtomicLaunchTargets: { readonly firstBuyExecutor: Address };
  createConfigAndPoolWithFirstBuy: (client: PublicClient, input: AtomicParameters) => Promise<AtomicPlan>;
};

/** Public SDK 0.3.7 includes this catalog API; older installations fail before RPC or signing. */
export function requireAtomicCatalogAPI(module: unknown = sdk): AtomicCatalogAPI {
  const candidate = module as Partial<AtomicCatalogAPI> | null;
  if (!candidate || typeof candidate.createConfigAndPoolWithFirstBuy !== "function" ||
      !candidate.giwaSepoliaAtomicLaunchDeployment ||
      !/^0x[0-9a-fA-F]{40}$/.test(candidate.giwaSepoliaAtomicLaunchTargets?.firstBuyExecutor ?? "")) {
    throw new Error("Built-in atomic API requires SDK 0.3.7 or later. Install @ammora-protocol/sdk@0.3.7; no local candidate or deployment JSON is needed for the GIWA catalog.");
  }
  return candidate as AtomicCatalogAPI;
}

/** No deployment/target JSON. The only policy is the partner's own recipients/economics. */
export async function planTeamAtomicFromCatalog(client: PublicClient, blockNumber: bigint,
  policy: TeamRecipientPolicy, input: TeamAtomicInput) {
  const api = requireAtomicCatalogAPI(), deployment = api.giwaSepoliaAtomicLaunchDeployment;
  const helper = api.giwaSepoliaAtomicLaunchTargets.firstBuyExecutor;
  if (!helper || deployment.chain.id !== 91342 || client.chain?.id !== deployment.chain.id) {
    throw new Error("Built-in atomic launch requires the reviewed GIWA auto-route catalog and RPC chain");
  }
  const template = await sdk.getAmmoraV4ConfigAtBlock(client, deployment.contracts.configRegistry, BigInt(policy.templateId), blockNumber);
  const reviewed = prepareTeamAtomicFirstBuy(template, policy, {
    chainId: deployment.chain.id, registry: deployment.contracts.configRegistry,
    factory: deployment.contracts.launchFactory, firstBuyExecutor: helper,
  }, input);
  const plan = await api.createConfigAndPoolWithFirstBuy(client, { ...reviewed.parameters, blockNumber });
  return { deployment, helper, reviewed, plan };
}
