import { almmRewardManagerAbi } from "@ammora-protocol/sdk";
import { erc20Abi, parseEventLogs, parseAbi, type Address, type Hash, type PublicClient } from "viem";
import { same } from "../../src/stablecoin/manifest.js";
export async function verifyUnifiedPayout(client: PublicClient, hash: Hash, expected: { reward: Address; pool: Address; tokenId: bigint; recipient: Address; caller: Address; base: Address; quote: Address }) {
  const receipt = await client.getTransactionReceipt({ hash });
  if (receipt.transactionHash !== hash || receipt.logs.some(log => log.removed) || receipt.status !== "success" || (await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error("Noncanonical or reverted payout receipt");
  const claims = parseEventLogs({ abi: almmRewardManagerAbi, eventName: "ALMMPositionFeeClaimed", logs: receipt.logs }).filter(x => same(x.address, expected.reward));
  if (claims.length !== 1) throw new Error("Expected exactly one matching fee claim");
  const claim = claims[0]!.args;
  if (claim.tokenId !== expected.tokenId || !same(claim.pool, expected.pool) || !same(claim.recipient, expected.recipient) || !same(claim.caller, expected.caller) || claim.baseAmount + claim.quoteAmount === 0n) throw new Error("Claim event differs or is a zero-fee no-op");
  const balances = [];
  for (const [token, amount] of [[expected.base, claim.baseAmount], [expected.quote, claim.quoteAmount]] as const) {
    const before = await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [expected.recipient], blockNumber: receipt.blockNumber - 1n });
    const after = await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [expected.recipient], blockNumber: receipt.blockNumber });
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter(x => same(x.address, token));
    const delta = transfers.reduce((n, x) => n + (same(x.args.to, expected.recipient) ? x.args.value : 0n) - (same(x.args.from, expected.recipient) ? x.args.value : 0n), 0n);
    if (amount !== delta || after - before !== amount) throw new Error("Claim/event/transfer/exact-block balance mismatch");
    balances.push({ token, before, after, increase: amount });
  }
  return { classification: "PASSED_THIS_RUN", hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, balances, feeOnly: true, positivePayout: true };
}


const registrationAbi = parseAbi([
  "event StandardTokenRegistered(address indexed token,address indexed prover,uint256 probeAmount)",
  "function policy(address) view returns(uint8,bool,bool,bool)",
]);
/** Registration is an exact round trip, never a fee payout or an issuer certification. */
export async function verifyUnifiedRegistration(client: PublicClient, hash: Hash, expected: { registry: Address; token: Address; caller: Address; amount: bigint }) {
  if (expected.amount <= 0n) throw new Error("Positive registration probe required");
  const receipt = await client.getTransactionReceipt({ hash });
  if (receipt.transactionHash !== hash || receipt.status !== "success" || receipt.blockNumber < 1n || receipt.logs.some(l => l.removed) || (await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error("Noncanonical or reverted registration receipt");
  const events = parseEventLogs({ abi: registrationAbi, eventName: "StandardTokenRegistered", logs: receipt.logs }).filter(l => same(l.address, expected.registry));
  if (events.length !== 1 || !same(events[0]!.args.token, expected.token) || !same(events[0]!.args.prover, expected.caller) || events[0]!.args.probeAmount !== expected.amount) throw new Error("Registry event differs from reviewed probe");
  const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter(l => same(l.address, expected.token));
  if (transfers.length !== 2) throw new Error("Expected two exact probe transfers");
  for (const [from, to] of [[expected.caller, expected.registry], [expected.registry, expected.caller]] as const) {
    if (transfers.filter(l => same(l.args.from, from) && same(l.args.to, to) && l.args.value === expected.amount).length !== 1) throw new Error("Probe transfer path/amount mismatch");
  }
  const balances = [];
  for (const address of [expected.caller, expected.registry]) {
    const before = await client.readContract({ address: expected.token, abi: erc20Abi, functionName: "balanceOf", args: [address], blockNumber: receipt.blockNumber - 1n });
    const after = await client.readContract({ address: expected.token, abi: erc20Abi, functionName: "balanceOf", args: [address], blockNumber: receipt.blockNumber });
    if (before !== after) throw new Error("Registration did not return exact funds");
    balances.push({ address, before, after, delta: after - before });
  }
  const policy = await client.readContract({ address: expected.registry, abi: registrationAbi, functionName: "policy", args: [expected.token], blockNumber: receipt.blockNumber });
  if (policy[0] !== 1 || !policy[1] || !policy[2] || !policy[3]) throw new Error("Registry did not classify the exact-transfer token");
  if ((await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error("Registration block reorganized");
  return { classification: "PASSED_THIS_RUN" as const, hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, registry: expected.registry, token: expected.token, prover: expected.caller, amount: expected.amount, balances, policy, registrationVerified: true, issuerCertified: false, feePayout: false };
}
