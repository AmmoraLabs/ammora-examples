/**
 * List the concentrated (ARL) positions a wallet holds, and what each is owed.
 * Reads only, so no key is required.
 *
 *   npm run arl:get-user-positions -- <ownerAddress>
 *
 * ── How listing works on EVM ───────────────────────────────────────────────────
 * There is no equivalent of Solana's "scan every account owned by this program".
 * Positions are ERC-721 tokens and the manager does not implement the enumerable
 * extension, so you cannot ask it which tokens an address holds.
 *
 * What you can do is read the standard ERC-721 `Transfer(from, to, tokenId)`
 * event, filtered on `to`, which is indexed so the node does the work. Every way
 * a position can arrive is a Transfer: minting is a transfer from the zero
 * address, and so is receiving one from someone else.
 *
 * Filtering the manager's own `PositionCreated` event instead would miss
 * positions that arrived by transfer, including ones created through the
 * factory's locked-creation route, where the factory mints to itself, seals the
 * position and only then hands it over.
 *
 * Two consequences any production listing has to handle:
 *
 *   1. A Transfer *in* does not mean the wallet still holds it. Ownership is
 *      re-read from the chain before anything is reported.
 *   2. Log queries are bounded by the RPC. Public endpoints cap the block span
 *      per request, so this walks the range in chunks from the deployment's own
 *      start block instead of asking for all of history at once.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import {
  ammConcentratedPoolV3Abi,
  ammConcentratedPositionManagerV3Abi,
} from "@ammora-protocol/sdk";
import { isContractRevert } from "../shared/retry.js";
import type { Address } from "viem";
import { address, deployment, reader } from "../shared/env.js";
import { amount, main, readWithRetry, tokenInfo } from "../shared/run.js";

/** The standard ERC-721 event; `to` is indexed, so the node filters for us. */
const erc721TransferAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

/** Conservative span per `eth_getLogs`; raise it against an endpoint you control. */
const BLOCK_CHUNK = 50_000n;

main(async () => {
  const owner = address("AMMORA_OWNER", process.argv[2]);
  const client = await reader();
  const target = deployment();
  const manager = target.contracts.launch.concentratedPositionManager;

  const head = await client.getBlockNumber({ cacheTime: 0 });
  console.log(`owner    ${owner}`);
  console.log(`manager  ${manager}`);
  console.log(`scanning blocks ${target.startBlock} .. ${head}\n`);

  const received = new Set<bigint>();
  for (let from = target.startBlock; from <= head; from += BLOCK_CHUNK) {
    const to = from + BLOCK_CHUNK - 1n > head ? head : from + BLOCK_CHUNK - 1n;
    const logs = await readWithRetry(() => client.getContractEvents({
      abi: erc721TransferAbi,
      address: manager,
      eventName: "Transfer",
      args: { to: owner },
      fromBlock: from,
      toBlock: to,
    }));
    for (const log of logs) {
      const { tokenId } = log.args as { tokenId?: bigint };
      if (tokenId !== undefined) received.add(tokenId);
    }
  }

  if (received.size === 0) {
    console.log("no position has ever been transferred to this wallet on this deployment");
    return;
  }

  let held = 0;
  for (const tokenId of [...received].sort((a, b) => (a < b ? -1 : 1))) {
    // A revert means the token does not exist, so it was burned or never minted.
    // Any other failure (a rate limit, a dropped connection) must not be read as
    // "not owned", or the listing quietly under-reports what the wallet holds.
    const current = await readWithRetry(() => client.readContract({
      abi: ammConcentratedPositionManagerV3Abi,
      address: manager, functionName: "ownerOf", args: [tokenId], blockNumber: head,
    })).catch((error: unknown) => {
      if (isContractRevert(error)) return null;
      throw error;
    }) as Address | null;
    if (current === null || current.toLowerCase() !== owner.toLowerCase()) continue;
    held += 1;

    const position = await client.readContract({
      abi: ammConcentratedPositionManagerV3Abi,
      address: manager, functionName: "getPosition", args: [tokenId], blockNumber: head,
    }) as {
      pool: Address;
      unlockedLiquidity: bigint;
      permanentLockedLiquidity: bigint;
      vestedLiquidity: bigint;
    };
    const pool = position.pool;

    console.log(`  token ${tokenId}  pool ${pool}`);
    console.log(`      unlocked        ${position.unlockedLiquidity}`);
    console.log(`      locked forever  ${position.permanentLockedLiquidity}`);
    console.log(`      vesting         ${position.vestedLiquidity}`);

    const [base, quote] = await Promise.all([
      client.readContract({ abi: ammConcentratedPoolV3Abi, address: pool, functionName: "baseToken", blockNumber: head }),
      client.readContract({ abi: ammConcentratedPoolV3Abi, address: pool, functionName: "quoteToken", blockNumber: head }),
    ]) as [Address, Address];
    const [baseInfo, quoteInfo] = await Promise.all([
      tokenInfo(client, base, head),
      tokenInfo(client, quote, head),
    ]);

    // Simulate the manager's claim, not the pool's. The pool numbers its own positions
    // separately, so a manager token id means something else there, and the call either
    // reports another position's fees or reverts for belonging to someone else.
    const owed = await client.simulateContract({
      abi: ammConcentratedPositionManagerV3Abi,
      account: owner,
      address: manager,
      functionName: "claimPositionFees",
      args: [tokenId, owner],
      blockNumber: head,
    }).then(({ result }) => result as readonly [bigint, bigint]).catch((cause: unknown) => {
      if (isContractRevert(cause)) return null;
      throw cause;
    });

    if (owed) {
      console.log(`      fees owed       ${amount(owed[0], baseInfo.decimals, baseInfo.symbol)}`);
      console.log(`                      ${amount(owed[1], quoteInfo.decimals, quoteInfo.symbol)}`);
    }
  }

  console.log(`\n${held} of ${received.size} received position(s) still held`);
});
