/**
 * Open a yield vault for a token, so deposits can earn without each holder doing anything.
 *
 *   npm run vault:create -- <assetToken> [performanceBps] [unlockDays]
 *
 * A vault takes deposits of one token and hands back shares. Whatever the vault earns
 * raises what a share is worth, so a depositor's balance grows without them acting, and
 * without them holding a position they have to manage.
 *
 * ── Where the yield comes from, and why it is not here ────────────────────────
 * A fresh vault earns nothing. It holds the asset and waits until a strategy is
 * approved for it and added, and only the owner may approve one. That separation
 * is the point: creating a vault is permissionless, but pointing depositors'
 * money at a strategy is not.
 *
 * So this creates an empty vault, which is a real thing to do and the only thing
 * that is yours to do without governance.
 *
 * ── The two numbers ───────────────────────────────────────────────────────────
 * `performanceBps` is the vault's cut of the yield, not of the deposit. It is
 * taken from the increase, so a vault that earns nothing charges nothing.
 *
 * `unlockDays` is what stops a share price jumping. Realised profit is released
 * into the share price gradually over that window rather than all at once. Paid
 * out instantly, anyone who deposited a block earlier would take a share of gains
 * earned before they arrived, and anyone watching could time exactly that.
 * ───────────────────────────────────────────────────────────────────────────────
 */
import type { Address } from "viem";
import { ammoraAYVaultFactoryAbi } from "@ammora-protocol/sdk";
import { address, deployment, explorerLink, reader, signer } from "../shared/env.js";
import { main, requireContract, tokenInfo } from "../shared/run.js";

/** The vault's share of yield. 500 is 5% of what is earned, not of what is held. */
const DEFAULT_PERFORMANCE_BPS = 500;

/** Days over which realised profit is released into the share price. */
const DEFAULT_UNLOCK_DAYS = 7;

main(async () => {
  const [assetArgument, feeArgument, daysArgument] = process.argv.slice(2);
  if (!assetArgument) {
    throw new Error("usage: npm run vault:create -- <assetToken> [performanceBps] [unlockDays]");
  }
  const asset = address("AMMORA_ASSET", assetArgument);
  const performanceFeeBps = Number(feeArgument ?? DEFAULT_PERFORMANCE_BPS);
  if (!Number.isInteger(performanceFeeBps) || performanceFeeBps < 0 || performanceFeeBps > 10_000) {
    throw new Error("performanceBps is between 0 and 10000");
  }
  const unlockDays = Number(daysArgument ?? DEFAULT_UNLOCK_DAYS);
  if (!Number.isInteger(unlockDays) || unlockDays <= 0) {
    throw new Error("unlockDays must be a whole number above 0");
  }

  const { wallet, account } = signer();
  const client = await reader();
  // Optional on the type, because slots deployed before the vault factories existed do
  // not carry them. Saying which deployment is short of them beats an undefined address
  // reaching a contract call.
  const vaults = deployment().contracts.vaults;
  if (!vaults) {
    throw new Error(
      `the ${deployment().slot} deployment has no vault factories;`
      + " set AMMORA_CHAIN_ID to a deployment that does",
    );
  }
  const factory = vaults.yieldFactory;
  await requireContract(client, "yield vault factory", factory);
  await requireContract(client, "asset token", asset);

  const info = await tokenInfo(client, asset);

  console.log(`factory      ${factory}`);
  console.log(`asset        ${info.symbol} (${asset})`);
  console.log(`performance  ${performanceFeeBps / 100}% of yield`);
  console.log(`unlock       over ${unlockDays} day(s)`);
  console.log("");

  const { request, result } = await client.simulateContract({
    abi: ammoraAYVaultFactoryAbi,
    account,
    address: factory,
    functionName: "createVault",
    args: [
      asset,
      // Operator, guardian and fee recipient are all this wallet here. In production
      // these are different parties on purpose: the operator moves funds between
      // strategies, the guardian can stop it, and neither should be the other.
      account.address,
      account.address,
      account.address,
      performanceFeeBps,
      unlockDays * 24 * 60 * 60,
      `0x${"00".repeat(32)}` as const,
    ],
  });
  const vault = (Array.isArray(result) ? result[0] : result) as Address;

  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`creation reverted: ${explorerLink(hash)}`);
  console.log(`  createVault: ${explorerLink(hash)}`);
  console.log(`\nvault is live at ${vault}`);
  console.log("deposit into it with: npm run vault:deposit -- " + vault + " <amount>");
});
