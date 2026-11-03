import type { Address, Hex, PublicClient, TransactionSerializableEIP1559 } from "viem";
import type { TeamRecipientPolicy } from "../launch/team/policy.js";

export type Action = "config" | "launch" | "config-first-buy" | "trade" | "migrate" | "claim-launch" | "claim-lp" | "approval";
export type Intent =
  | { action: "config"; policy: TeamRecipientPolicy; saleSupplyRaw: string; thresholdRaw: string }
  | { action: "launch"; configId: string; name: string; symbol: string; metadataURI: string; firstBuyRaw?: string; minimumBaseRaw?: string }
  | { action: "config-first-buy"; policy: TeamRecipientPolicy; saleSupplyRaw: string; thresholdRaw: string; name: string; symbol: string; metadataURI: string; firstBuyRaw: string; minimumBaseRaw: string }
  | { action: "trade"; curve: Address; side: "buy" | "sell"; amountRaw: string; slippageBps: number; graduationBoundary?: boolean; payout?: Address }
  | { action: "migrate"; curve: Address }
  | { action: "claim-launch"; curve: Address; asset: "base" | "quote"; payout?: Address }
  | { action: "claim-lp"; curve: Address; tokenId: string; payout?: Address }
  | { action: "approval"; parentId: string; requirementIndex: number; reset: boolean };

/** Installed by the application owner. Never accepted as a tool argument. */
export interface AgentPolicy {
  sessionId: string;
  account: Address;
  expiresAt: number;
  actions: readonly Action[];
  configs: readonly { id: string; hash: Hex }[];
  payouts: readonly Address[];
  assets: readonly { token: Address; maxInputRaw: string; maxSessionInputRaw: string }[];
  launchTokenLimit: { maxInputRaw: string; maxSessionInputRaw: string };
  maxNativePerTransactionWei: string;
  maxNativeSessionWei: string;
  maxFeePerGasWei: string;
  maxTransactions: number;
  maxSlippageBps: number;
  maxPlanAgeSeconds: number;
  maxPlanAgeBlocks: number;
}

export interface Snapshot { number: string; hash: Hex; timestamp: string }
export interface Requirement { token: Address; spender: Address; amountRaw: string; currentAllowanceRaw: string }
export interface AgentTransaction { to: Address; data: Hex; value: string }
export interface Plan {
  version: 1;
  id: string;
  requestId: string;
  intent: Intent;
  intentDigest: Hex;
  policyDigest: Hex;
  digest: Hex;
  account: Address;
  chainId: 91342;
  generation: "auto-route";
  snapshot: Snapshot;
  expiresAt: number;
  status: "READY" | "APPROVAL_REQUIRED" | "NO_CLAIMABLE_FEES";
  transaction?: AgentTransaction;
  approvals: Requirement[];
  input?: { token: Address; maximumRaw: string; sessionLimitRaw: string };
  expected: {
    configId?: string; configHash?: Hex; curve?: Address; token?: Address; pool?: Address;
    tokenIn?: Address; tokenOut?: Address; minimumOutputRaw?: string;
    payout?: Address; tokenId?: string; beneficiary?: Address;
    stage?: number; baseForQuote?: boolean; firstBuyRaw?: string;
  };
  details: unknown;
}
export type Phase = "PLANNED" | "AUTHORIZED" | "SIGNING" | "SIGNED" | "SUBMITTED" | "CONFIRMED" | "REVERTED" | "CANCELLED" | "RECONCILIATION_REQUIRED";
export interface Operation {
  plan: Plan; phase: Phase; hash?: Hex; nonce?: number; result?: unknown;
  errorCode?: string;
  signingRequest?: { gas: string; maxFeePerGas: string; value: string };
}
/** A signer can be injected only by trusted application code, outside the tool registry. */
export interface AgentSigner {
  address: Address;
  /** Optional non-signing service readiness check; runs before any nonce reservation. */
  assertReady?(): Promise<void>;
  signTransaction(request: TransactionSerializableEIP1559): Promise<Hex>;
}
export interface AgentOptions {
  policy: AgentPolicy;
  client: PublicClient;
  journalDirectory: string;
  signer?: AgentSigner;
  authorizationMode?: "per-operation" | "scoped-policy";
}
