// Shared transport/authority plumbing. Each action file still calls its SDK method explicitly.
import { keccak256, zeroAddress, type Address, type Hex, type PublicClient } from "viem";
import { ALMMClient, DammV2Client, type AmmoraTransaction, type ERC20ApprovalRequirement } from "@ammora-protocol/sdk";
import { address, clientOptions, deployment, readBlock, reader, signer } from "./env.js";
import { approve, requireContract, send } from "./run.js";
import { printJson } from "./input.js";

export const natural = (value: string | undefined, label: string, positive = false): bigint => {
  if (!value || !/^\d+$/.test(value)) throw new Error(`${label} must be a raw integer`);
  const number = BigInt(value);
  if (number >= 1n << 256n || positive && number === 0n) throw new Error(`${label} outside uint256 range`);
  return number;
};
export const caller = (): Address => {
  const value = address("AMMORA_ACCOUNT");
  if (value === zeroAddress) throw new Error("AMMORA_ACCOUNT must be a real caller");
  return value;
};
export const deadline = (): bigint => BigInt(Math.floor(Date.now() / 1000) + 600);
export type ActionContext = { client: PublicClient; caller: Address; allowedTargets: readonly Address[] };
export const validateAction = (transaction: AmmoraTransaction, allowedTargets: readonly Address[]) => {
  if (!allowedTargets.some(a => a.toLowerCase() === transaction.to.toLowerCase())) throw new Error("Plan targets a contract outside this action's reviewed scope");
};

/** Default is an unsigned preview. Send mode binds the same caller, exact simulation and nonces. */
export const execute = async (
  label: string, context: ActionContext, transactions: AmmoraTransaction | readonly AmmoraTransaction[],
  approvalRequirements: readonly ERC20ApprovalRequirement[] = [],
) => {
  const list = Array.isArray(transactions) ? transactions : [transactions];
  for (const transaction of list) validateAction(transaction, context.allowedTargets);
  for (const approval of approvalRequirements) {
    if (!context.allowedTargets.some(a => a.toLowerCase() === approval.spender.toLowerCase())) throw new Error("Approval spender outside reviewed action scope");
  }
  printJson({ mode: process.env.AMMORA_SEND === "1" ? "SEND_REQUESTED" : "UNSIGNED_PREVIEW", label,
    caller: context.caller, transactions: list, approvalRequirements, payoutVerified: false });
  if (process.env.AMMORA_SEND !== "1" || list.length === 0) return;
  const { account, wallet } = signer();
  if (account.address.toLowerCase() !== context.caller.toLowerCase()) throw new Error("Signer differs from preview caller");
  await approve(approvalRequirements, wallet, account, context.client);
  for (const transaction of list) {
    const hash = await send(label, transaction, wallet, account, context.client);
    printJson({ transactionHash: hash, executionConfirmed: true, payoutVerified: false });
  }
};

export const almm = async (poolArgument: string | undefined) => {
  const pool = address("ALMM_POOL", poolArgument), account = caller();
  const client = await reader();
  const c = deployment().contracts.liquidityMarketMaker;
  await requireContract(client, "ALMM pool", pool);
  const sdk = new ALMMClient(client, pool, c.positionManager, c.binLens, clientOptions());
  const state = await sdk.getPoolState(); // SDK factory provenance remains enabled.
  return { sdk, state, pool, client, caller: account, allowedTargets: [pool, c.positionManager, c.limitOrderManager, c.rewardManager] };
};
export const arl = async (poolArgument: string | undefined, kind: "concentrated" | "compounding" = "concentrated") => {
  const pool = address("ARL_POOL", poolArgument), account = caller();
  const client = await reader();
  const c = deployment().contracts.launch;
  await requireContract(client, "ARL pool", pool);
  const sdk = new DammV2Client(client, pool, kind, kind === "concentrated" ? c.concentratedFactory : c.compoundingFactory,
    kind === "concentrated" ? c.concentratedPositionManager : undefined, clientOptions());
  const state = await sdk.getPoolState();
  return { sdk, state, pool, client, caller: account, allowedTargets: [pool, c.concentratedPositionManager] };
};

export const assertPinnedCode = (code: Hex | undefined, expected: string): void => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(expected) || !code || code === "0x" || keccak256(code).toLowerCase() !== expected.toLowerCase()) {
    throw new Error("Feature contract runtime differs from the reviewed pin or contains no code");
  }
};

/** For products outside the built-in catalog, require an explicitly reviewed code pin. */
export const pinned = async (argument: string | undefined) => {
  const target = address("AMMORA_FEATURE_CONTRACT", argument), account = caller();
  const expected = process.env.AMMORA_FEATURE_RUNTIME_HASH?.trim();
  if (!expected || !/^0x[0-9a-fA-F]{64}$/.test(expected)) throw new Error("Set the reviewed AMMORA_FEATURE_RUNTIME_HASH; never derive it from this read");
  const client = await reader();
  const snapshot = await readBlock(client);
  const blockNumber = snapshot.number;
  const code = await client.getCode({ address: target, blockNumber });
  assertPinnedCode(code, expected);
  return { client, target, caller: account, blockNumber, allowedTargets: [target] };
};
