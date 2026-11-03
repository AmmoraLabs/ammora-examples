/**
 * Claim the selected fee asset accrued to you as creator or partner.
 * For WETH-denominated launch fees pass WETH, not the launched base token.
 *
 *   npm run launch:claim-fees -- <feeTokenAddress> [recipient]
 *
 * Creator and partner each sign for their own entitlement in the same FeeVault.
 * An optional payout address changes the destination, never the fee beneficiary.
 */
import {
  ammoraLaunchFactoryV4Abi,
  feeVaultAbi,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { zeroAddress } from "viem";
import { verifyFeePayment } from "../shared/fee-payment.js";
import { printJson } from "../shared/input.js";
import { address, readBlock, reader, signer, v4Deployment } from "../shared/env.js";
import { planOwnFeeClaim } from "./fee-claim-plan.js";
import {
  amount,
  main,
  requireContract,
  send,
  tokenInfo,
} from "../shared/run.js";

main(async () => {
  const token = address("AMMORA_FEE_TOKEN", process.argv[2]);
  const recipientArgument = process.argv[3];

  const { wallet, account } = signer();
  const client = await reader();
  // The factory names its own fee vault, so there is nothing to configure. Creator and
  // partner fees for every launch it made settle there.
  const contracts = v4Deployment().contracts.launch;
  const factory = contracts.factory;
  const { number: blockNumber } = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, {
    configRegistry: contracts.configRegistry,
    launchFactory: factory,
    graduationAdapter: contracts.graduationAdapter,
    feePolicy: contracts.feePolicy,
  }, blockNumber);
  const feeVault = await client.readContract({
    abi: ammoraLaunchFactoryV4Abi,
    address: factory,
    functionName: "feeVault",
    blockNumber,
  }) as `0x${string}`;

  const recipient = recipientArgument
    ? address("AMMORA_RECIPIENT", recipientArgument)
    : account.address;

  if (recipient === zeroAddress || recipient.toLowerCase() === feeVault.toLowerCase()) throw new Error("Payout must be nonzero and outside the fee vault");

  await requireContract(client, "fee vault", feeVault);
  await requireContract(client, "token", token);
  const info = await tokenInfo(client, token);

  const owed = await client.readContract({
    abi: feeVaultAbi,
    address: feeVault,
    functionName: "claimable",
    args: [token, account.address],
    blockNumber,
  }) as bigint;

  console.log(`fee vault  ${feeVault}`);
  console.log(`beneficiary ${account.address}`);
  console.log(`owed       ${amount(owed, info.decimals, info.symbol)}`);

  if (owed === 0n) {
    // Nothing has settled to this wallet for this token, so say so rather than spend gas.
    console.log("\nnothing owed for this token, no transaction sent");
    return;
  }
  console.log(`paying to  ${recipient}`);

  const transaction = planOwnFeeClaim(token, account.address, recipient);
  const hash = await send(
    "claim V4 launch fees",
    { to: feeVault, data: transaction.data },
    wallet,
    account,
    client,
  );
  const payment = await verifyFeePayment(client, {
    kind: "launch", hash, vault: feeVault, token, beneficiary: account.address, payout: recipient,
  });
  printJson(payment);
  console.log(`received   ${amount(payment.netAmount, info.decimals, info.symbol)}`);
});
