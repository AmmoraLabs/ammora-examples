import { isContractRevert } from "../shared/retry.js";
import { tokenAmount } from "../shared/input.js";
/**
 * Join a genesis vault before its pool opens.
 *
 *   npm run vault:genesis-deposit -- <vaultAddress> <amount>
 *
 * The depositor's side of `vault:genesis`. You put in the quote token during the window;
 * when it closes, the authority fills at one price and everyone is filled at that price.
 *
 * ── Being early buys nothing, and that is the point ───────────────────────────
 * Deposits past the vault's buy cap are accepted and refunded pro rata, so
 * depositing in the first second and the last second get the same treatment. That
 * is the whole difference from buying at the open, where the first block is worth
 * paying for.
 *
 * What it means in practice is that the amount you put in is not the amount you
 * spend. Over-subscribed, everyone gets a slice of the cap and the rest back.
 *
 * ── Nothing to claim until it is finalised ────────────────────────────────────
 * Depositing does not give you the token. The window has to close, the authority
 * has to fill and finalise, and only then do `claimBase` and `claimRefund` pay
 * out. This reports what is claimable so far, which before finalisation is
 * correctly nothing.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import { ammAGVaultAbi } from "@ammora-protocol/sdk";
import { address, reader, signer } from "../shared/env.js";
import { amount, approve, main, preflight, requireContract, send, tokenInfo } from "../shared/run.js";

main(async () => {
  const [vaultArgument, amountArgument] = process.argv.slice(2);
  const vault = address("AMMORA_VAULT", vaultArgument);
  if (!amountArgument) {
    throw new Error("usage: npm run vault:genesis-deposit -- <vaultAddress> <amount>");
  }

  const { wallet, account } = signer();
  const client = await reader();
  await requireContract(client, "vault", vault);

  // Ask the vault directly. Its `pool` field holds the adapter the factory installed,
  // not the AMM pool, and pointing a pool client at that adapter fails on the first read
  // it does not implement. The vault names both of its tokens itself.
  const quoteToken = await client.readContract({
    abi: ammAGVaultAbi, address: vault, functionName: "quoteToken",
  }).catch((cause: unknown) => {
    if (!isContractRevert(cause)) throw cause;
    throw new Error(`${vault} does not answer as a genesis vault on this chain`);
  }) as Address;

  const quote = await tokenInfo(client, quoteToken);
  const assets = tokenAmount(amountArgument, quote.decimals);

  console.log(`vault      ${vault}`);
  console.log(`taking     ${quote.symbol}`);
  console.log(`depositing ${amount(assets, quote.decimals, quote.symbol)}`);
  console.log("");

  const transaction = {
    to: vault,
    data: (await import("viem")).encodeFunctionData({
      abi: ammAGVaultAbi,
      functionName: "deposit",
      // No whitelist on this vault, so there is no proof to present and no cap to prove.
      // A gated vault takes the depositor's leaf cap and its merkle proof here.
      args: [assets, 0n, []],
    }),
  };

  await approve(
    [{ token: quoteToken, spender: vault, amount: assets }],
    wallet,
    account,
    client,
  );
  await preflight(client, account, transaction, ammAGVaultAbi, "deposit");
  const hash = await send("deposit", transaction, wallet, account, client);
  const { blockNumber } = await client.getTransactionReceipt({ hash });

  const [base, refund] = await Promise.all([
    client.readContract({
      abi: ammAGVaultAbi, address: vault, functionName: "claimableBase", args: [account.address], blockNumber,
    }),
    client.readContract({
      abi: ammAGVaultAbi, address: vault, functionName: "claimableRefund", args: [account.address], blockNumber,
    }),
  ]) as [bigint, bigint];

  console.log(`\nclaimable now: ${base} base, ${refund} refund`);
  console.log("both stay zero until the window closes and the authority finalises");
});
