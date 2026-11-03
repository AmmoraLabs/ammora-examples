import { isContractRevert } from "../shared/retry.js";
import { tokenAmount } from "../shared/input.js";
import { slippage } from "../shared/input.js";
/**
 * Put tokens into a yield vault, and read what the shares are worth.
 *
 *   npm run vault:deposit -- <vaultAddress> <amount>
 *
 * Depositing exchanges the asset for shares. Shares are the claim; the asset is what the
 * vault holds and puts to work. What changes over time is not how many shares you hold
 * but what one is worth, so the balance to watch is the assets your shares redeem for,
 * not the share count.
 *
 * ── The floor that is easy to leave at zero ───────────────────────────────────
 * `minimumShares` is the same protection a swap's minimum-out gives. A deposit
 * mints shares at the price when it lands, not when it was signed, and anything
 * that moves the vault in between moves that price. Passing zero accepts whatever
 * comes back, which on a vault holding real money is an invitation.
 *
 * This quotes the deposit first and asks for slightly less, which is what makes
 * the floor a real number rather than a gesture.
 *
 * ── Getting out is not always immediate ───────────────────────────────────────
 * `redeem` works when the vault holds enough asset unallocated. When it does not,
 * because the money is working, the way out is `requestRedeem`, which queues a
 * withdrawal for the operator to fill. That is a property of a vault that is
 * actually deployed into strategies, and worth knowing before depositing rather
 * than at the moment you want out.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import { ammoraAYVaultAbi, minOutFromSlippage } from "@ammora-protocol/sdk";
import { address, deployment, reader, signer } from "../shared/env.js";
import {
  amount,
  approve,
  main,
  preflight,
  readAtBlockWithRetry,
  requireContract,
  send,
  tokenInfo,
} from "../shared/run.js";

const slippageBps = slippage();

main(async () => {
  const [vaultArgument, amountArgument] = process.argv.slice(2);
  const vault = address("AMMORA_VAULT", vaultArgument);
  if (!amountArgument) {
    throw new Error("usage: npm run vault:deposit -- <vaultAddress> <amount>");
  }

  const { wallet, account } = signer();
  const client = await reader();
  await requireContract(client, "vault", vault);

  const asset = await client.readContract({
    abi: ammoraAYVaultAbi, address: vault, functionName: "asset",
  }).catch((cause: unknown) => {
    if (!isContractRevert(cause)) throw cause;
    throw new Error(`${vault} does not answer as a yield vault on this chain`);
  }) as Address;

  const info = await tokenInfo(client, asset);
  const assets = tokenAmount(amountArgument, info.decimals);

  // What this deposit would mint at the current price, which is what the floor is set
  // against. Reading it also proves the vault will accept the size at all.
  const expectedShares = await client.readContract({
    abi: ammoraAYVaultAbi, address: vault, functionName: "previewDeposit", args: [assets],
  }) as bigint;
  const minimumShares = minOutFromSlippage(expectedShares, BigInt(slippageBps));

  const [totalAssets, totalSupply] = await Promise.all([
    client.readContract({ abi: ammoraAYVaultAbi, address: vault, functionName: "totalAssets" }),
    client.readContract({ abi: ammoraAYVaultAbi, address: vault, functionName: "totalSupply" }),
  ]) as [bigint, bigint];

  console.log(`vault      ${vault}`);
  console.log(`asset      ${info.symbol}`);
  console.log(`depositing ${amount(assets, info.decimals, info.symbol)}`);
  console.log(`shares     ${expectedShares} expected, floor ${minimumShares}`);
  console.log(`vault now  ${amount(totalAssets, info.decimals, info.symbol)} across ${totalSupply} shares`);
  console.log("");

  const transaction = {
    to: vault,
    data: (await import("viem")).encodeFunctionData({
      abi: ammoraAYVaultAbi,
      functionName: "deposit",
      args: [assets, account.address, minimumShares],
    }),
  };

  await approve(
    [{ token: asset, spender: vault, amount: assets }],
    wallet,
    account,
    client,
  );
  await preflight(client, account, transaction, ammoraAYVaultAbi, "deposit");
  const hash = await send("deposit", transaction, wallet, account, client);
  const receipt = await client.getTransactionReceipt({ hash });

  const held = await readAtBlockWithRetry(receipt.blockNumber, () => client.readContract({
    abi: ammoraAYVaultAbi,
    address: vault,
    functionName: "balanceOf",
    args: [account.address],
    blockNumber: receipt.blockNumber,
  })) as bigint;
  const worth = await readAtBlockWithRetry(receipt.blockNumber, () => client.readContract({
    abi: ammoraAYVaultAbi,
    address: vault,
    functionName: "convertToAssets",
    args: [held],
    blockNumber: receipt.blockNumber,
  })) as bigint;
  console.log(`\nholding ${held} shares, redeemable for ${amount(worth, info.decimals, info.symbol)}`);
});
