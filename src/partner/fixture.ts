/** Synthetic local transport, not a deployed profile or proof of real authorization. */
import { createPoolRightsSdkEntryV2, POOL_RIGHTS_MODULE_ABI, PartnerLifecycleErrorV1,
  type PoolRightsProfileV1, type ProductReadOptions, type PartnerTransactionPlanV2 } from "@ammora-protocol/sdk/partner";
import { decodeFunctionData, keccak256, stringToHex, type Address, type Hex } from "viem";

const address = (digit: string) => `0x${digit.repeat(40)}` as Address;
const hash = (digit: string) => `0x${digit.repeat(64)}` as Hex;
export const fixtureActors = { owner: address("1"), beneficiary: address("2"), ammora: address("3"), stranger: address("b") };
export const fixtureToken = address("a");
export const fixtureTransactionHash = hash("e");
export type FixtureObservation = "unknown" | "pending" | "invalid" | "orphaned" | "reverted" | "observed" | "finalized";
export const fixtureModes: readonly FixtureObservation[] = ["unknown", "pending", "invalid", "orphaned", "reverted", "observed", "finalized"];

export const createPartnerFixture = (settings: { authorized?: boolean; wrongRuntime?: boolean; maxReads?: number } = {}) => {
  const code = "0x60006000f3" as Hex;
  const pin = (digit: string) => ({ address: address(digit), runtimeHash: keccak256(code) });
  const profile: PoolRightsProfileV1 = {
    chainId: 31337, genesisHash: hash("c"), controller: fixtureActors.owner, ammora: fixtureActors.ammora,
    factory: pin("6"), registry: pin("5"), driver: pin("7"), module: pin("4"), delegation: pin("8"),
    delegationReview: { scope: "local-fork", evidenceHash: hash("d") },
  };
  const calls: string[] = [];
  let observation: FixtureObservation = "unknown";
  let action: PartnerTransactionPlanV2 | undefined;
  const head = { number: "0x65", hash: hash("f"), timestamp: "0x6553f100" };
  const receiptBlock = { number: "0x64", hash: hash("d"), timestamp: head.timestamp };
  const read: ProductReadOptions = {
    chainId: "31337", genesisHash: profile.genesisHash, tag: "latest", maxReads: settings.maxReads ?? 64, timeoutMs: 5000,
    clock: () => 1700000000000,
    async beforeRead(_method, signal) { if (signal.aborted) throw new Error("ABORTED"); },
    async request(method, params, signal) {
      if (signal.aborted) throw new Error("ABORTED");
      calls.push(method);
      if (method === "eth_chainId") return "0x7a69";
      if (method === "eth_getBlockByNumber") {
        const tag = params[0];
        if (tag === "0x0") return { ...head, number: "0x0", hash: profile.genesisHash };
        if (tag === "0x64") return observation === "orphaned" ? { ...receiptBlock, hash: hash("9") } : receiptBlock;
        if ((tag === "safe" || tag === "finalized") && observation === "observed") return null;
        if (["latest", "safe", "finalized", "0x65"].includes(String(tag))) return head;
        throw new Error("UNEXPECTED_BLOCK");
      }
      if (method === "eth_getCode") {
        const target = String(params[0]).toLowerCase();
        if ([profile.module, profile.factory, profile.registry, profile.driver, profile.delegation].some(x => x.address.toLowerCase() === target)) return settings.wrongRuntime ? "0x6001" : code;
        if (target === fixtureActors.beneficiary || target === fixtureActors.stranger) return "0x";
        throw new Error("UNREVIEWED_CODE_TARGET");
      }
      if (method === "eth_call") {
        const tx = params[0] as { to: Address; from: Address; data: Hex };
        const decoded = decodeFunctionData({ abi: POOL_RIGHTS_MODULE_ABI, data: tx.data });
        if (tx.to.toLowerCase() !== profile.module.address.toLowerCase() || decoded.functionName !== "claim") throw new Error("UNSUPPORTED_FIXTURE_CALL");
        if (settings.authorized === false || tx.from.toLowerCase() !== fixtureActors.beneficiary) throw new PartnerLifecycleErrorV1("forbidden");
        return "0x";
      }
      if (method === "eth_getTransactionByHash") {
        if (observation === "unknown") return null;
        if (!action || params[0] !== fixtureTransactionHash) throw new Error("UNREVIEWED_HASH");
        return { hash: fixtureTransactionHash, from: observation === "invalid" ? fixtureActors.stranger : action.request.account,
          to: action.request.to, input: action.request.data, value: "0x0", blockNumber: observation === "pending" ? null : receiptBlock.number };
      }
      if (method === "eth_getTransactionReceipt") {
        if (observation === "unknown" || observation === "pending") return null;
        if (params[0] !== fixtureTransactionHash) throw new Error("UNREVIEWED_HASH");
        return { transactionHash: fixtureTransactionHash, blockNumber: receiptBlock.number,
          blockHash: receiptBlock.hash, status: observation === "reverted" ? "0x0" : "0x1", logs: [] };
      }
      throw new Error("UNEXPECTED_RPC_OR_BROADCAST");
    },
  };
  const route = { stage: "pool", direction: "buy", assetIn: { kind: "native" },
    assetOut: { kind: "erc20", address: fixtureToken }, mode: "exact-input", account: "reviewed-batch",
    hops: 1, ports: [profile.module.address], partnerRecipients: 1 } as const;
  const entry = createPoolRightsSdkEntryV2({
    review: { id: "synthetic-pool-rights", revision: "1", evidenceHash: keccak256(stringToHex("SYNTHETIC_OFFLINE_ONLY")) },
    source: address("9"), profile, read, routes: [route], custodyAssets: [{ kind: "native" }, { kind: "erc20", address: fixtureToken }],
  });
  return { profile, read, entry, route, calls, scope: "SYNTHETIC_OFFLINE" as const,
    observe(plan: PartnerTransactionPlanV2, mode: FixtureObservation) { action = plan; observation = mode; } };
};
