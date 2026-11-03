/**
 * Claim the fees a concentrated (ARL) position has earned.
 *
 *   npm run arl:claim-position-fee -- <poolAddress> <tokenId> [recipient]
 *
 * The token id is the one `arl:get-user-positions` prints, which is the position
 * manager's NFT. The optional recipient receives only fees; NFT ownership, locked
 * principal and future fee rights remain with the owner. Omitting it pays the owner,
 * including when an authorized fee delegate is the connected caller.
 *
 * ── Two things called "position 1" ────────────────────────────────────────────
 * A concentrated pool keeps its own positions, numbered per pool, and the position
 * manager wraps them as ERC-721 tokens numbered per manager. Both accept a
 * `tokenId` and both answer `ownerOf`, so passing an id from one to the other does
 * not fail loudly. It reports a different position, or refuses because that id
 * belongs to someone else entirely.
 *
 * Every example here works in the manager's numbering, because that is what a
 * wallet actually holds and what the listing script can enumerate. The managed
 * calls also check the caller's permission on the token, so a delegate can claim
 * where the owner allowed it.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import { DammV2Client, ammConcentratedPositionManagerV3Abi, resolveAmmConcentratedPositionFeeClaimReceipt } from "@ammora-protocol/sdk";
import { zeroAddress } from "viem";
import { clientOptions, address, deployment, reader, signer } from "../shared/env.js";
import { amount, asPool, main, positionOwner, requireContract, send, tokenInfo } from "../shared/run.js";

main(async () => {
  const [poolArgument, tokenIdArgument, recipientArgument, ...extra] = process.argv.slice(2);
  const pool = address("ARL_POOL", poolArgument);
  if (!tokenIdArgument || !/^\d+$/.test(tokenIdArgument) || extra.length) {
    throw new Error("pass the position token id: npm run arl:claim-position-fee -- <pool> <tokenId> [recipient]");
  }
  const tokenId = BigInt(tokenIdArgument);
  const requestedRecipient = recipientArgument === undefined ? undefined : address("LP_FEE_RECIPIENT", recipientArgument);
  if (requestedRecipient === zeroAddress) throw new Error("LP fee recipient must not be the zero address");

  const { wallet, account } = signer();
    const client = await reader();
  const contracts = deployment().contracts.launch;

  // The SDK proves the pool came from the reviewed factory before planning anything that
  // moves value, so an address from a link or a search result is refused here instead of
  // after an approval has been signed.
  await requireContract(client, "pool", pool);
  const sdk = new DammV2Client(
    client, pool, "concentrated", contracts.concentratedFactory, contracts.concentratedPositionManager, clientOptions(),
  );
  const state = await asPool(pool, "a concentrated pool", () => sdk.getPoolState());
  const [base, quote] = await Promise.all([
    tokenInfo(client, state.baseToken),
    tokenInfo(client, state.quoteToken),
  ]);

  const owner = await positionOwner(client, ammConcentratedPositionManagerV3Abi, contracts.concentratedPositionManager, tokenId);

  console.log(`pool     ${pool}`);
  console.log(`position ${tokenId} owned by ${owner}`);

  // Default to the NFT owner even when a fee delegate is connected. The SDK
  // checks ClaimFee vs ClaimFeeToOwner and rejects unauthorized redirection.
  const recipient = requestedRecipient ?? owner;
  console.log(`caller   ${account.address}`);

  const transaction = await sdk.planClaimManagedConcentratedFees(
    tokenId, recipient, account.address,
  );

  // Simulating returns exactly what the claim would pay, without sending it. Reading the
  // position's stored counters instead would be behind: claiming accrues first, so they
  // lag by whatever the position has earned since it was last touched.
  const { result } = await client.simulateContract({
    abi: ammConcentratedPositionManagerV3Abi,
    account,
    address: contracts.concentratedPositionManager,
    functionName: "claimPositionFees",
    args: [tokenId, recipient],
  });
  const [claimableBase, claimableQuote] = result as readonly [bigint, bigint];

  console.log(`claimable ${amount(claimableBase, base.decimals, base.symbol)}`);
  console.log(`          ${amount(claimableQuote, quote.decimals, quote.symbol)}`);

  if (claimableBase === 0n && claimableQuote === 0n) {
    console.log("\nnothing owed, no transaction sent");
    return;
  }

  console.log(`\nclaiming fees to ${recipient}`);
  const hash = await send("claimPositionFees", transaction, wallet, account, client);
  const receipt = await client.getTransactionReceipt({ hash });
  const paid = resolveAmmConcentratedPositionFeeClaimReceipt({
    chainId: deployment().chain.id, receipt, expectedTransactionHash: hash,
    positionManager: contracts.concentratedPositionManager, tokenId, recipient,
  });
  console.log(`\nclaimed ${amount(paid.baseAmount, base.decimals, base.symbol)}`
    + ` and ${amount(paid.quoteAmount, quote.decimals, quote.symbol)} from the confirmed receipt`);
});
