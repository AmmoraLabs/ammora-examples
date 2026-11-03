import { buildCreateAFSVault } from "@ammora-protocol/sdk";
import { encodeAbiParameters, getAddress, isAddress, keccak256, zeroAddress, type Address, type Hex } from "viem";

export const parseSharingPolicy = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("sharing policy must be an object");
  const value = input as Record<string, unknown>;
  const fields = ["schemaVersion", "chainId", "factory", "owner", "token", "base", "recipients", "userSalt"];
  if (Object.keys(value).length !== fields.length || fields.some(field => !(field in value))) throw new Error("sharing policy fields differ from schema");
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.chainId) || Number(value.chainId) <= 0) throw new Error("invalid schemaVersion/chainId");
  const address = (candidate: unknown): Address => {
    if (typeof candidate !== "string" || !isAddress(candidate, { strict: true }) || candidate.toLowerCase() === zeroAddress) throw new Error("expected nonzero checksummed or lowercase address");
    return getAddress(candidate);
  };
  if (!Array.isArray(value.recipients) || value.recipients.length < 2 || value.recipients.length > 5) throw new Error("use 2 to 5 recipients");
  const recipients = value.recipients.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join() !== "recipient,share") throw new Error("recipient requires recipient and share");
    const entry = row as Record<string, unknown>;
    if (typeof entry.share !== "string" || !/^[1-9]\d*$/.test(entry.share)) throw new Error("share must be a positive integer string weight");
    return { recipient: address(entry.recipient), share: BigInt(entry.share) };
  });
  if (new Set(recipients.map(row => row.recipient.toLowerCase())).size !== recipients.length) throw new Error("duplicate recipient");
  const totalShares = recipients.reduce((sum, row) => sum + row.share, 0n);
  if (totalShares > 4294967295n) throw new Error("sum of share weights exceeds uint32");
  if (typeof value.userSalt !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value.userSalt)) throw new Error("userSalt must be bytes32");
  return { schemaVersion: 1 as const, chainId: Number(value.chainId), factory: address(value.factory), owner: address(value.owner),
    token: address(value.token), base: address(value.base), recipients, userSalt: value.userSalt as Hex, totalShares };
};

export const planSharingPolicy = (input: unknown) => {
  const policy = parseSharingPolicy(input);
  const transaction = { to: policy.factory, ...buildCreateAFSVault(policy.token, policy.base, policy.recipients, policy.userSalt) };
  // Sender is not encoded in createVault calldata, but changes ownership and CREATE2 identity.
  const reviewHash = keccak256(encodeAbiParameters(
    [{ type: "uint256" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [BigInt(policy.chainId), policy.owner, transaction.to, 0n, transaction.data],
  ));
  return { policy, transaction, reviewHash,
    recipients: policy.recipients.map((row, index) => ({ index, ...row, ratio: row.share.toString() + "/" + policy.totalShares.toString() })),
    note: "Weights are relative, not BPS. One token per vault. Funding and each recipient claim are separate; integer rounding/dust follows the contract.",
  };
};
