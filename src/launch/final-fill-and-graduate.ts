/**
 * Finish a V4 launch curve and execute its separate permissionless Graduation.
 *
 *   AMMORA_GRADUATION_CONFIRM=1 npm run launch:graduate -- <curve> <quoteInputRaw>
 *
 * The input is a maximum, not a promise to spend it all. At the terminal
 * quote-to-base boundary the curve consumes only what remains fillable and
 * returns `amountLeft` to the payer. A second transaction calls `migrate()`;
 * applications normally enqueue that permissionless step in a migrator rather
 * than ask the trading user for another signature.
 */
import {
  AmmoraV4LaunchCurveClient,
  classifyAmmoraV4ExactInputFill,
  parseAmmoraV4MigratedReceipt,
  parseAmmoraV4SwapReceipt,
} from "@ammora-protocol/sdk";
import { address, v4Deployment, reader, signer, readBlock } from "../shared/env.js";
import { planCurveAtBlock } from "./curve-plan.js";
import { approve, main, send } from "../shared/run.js";

main(async () => {
  const [curveArgument, inputArgument] = process.argv.slice(2);
  const curve = address("AMMORA_LAUNCH_CURVE", curveArgument);
  if (!inputArgument || !/^\d+$/.test(inputArgument) || BigInt(inputArgument) === 0n) {
    throw new Error("quoteInputRaw must be a positive raw-unit integer");
  }
  const maximumQuoteInput = BigInt(inputArgument);
  if (process.env.AMMORA_GRADUATION_CONFIRM !== "1") throw new Error("Set AMMORA_GRADUATION_CONFIRM=1 after reviewing the maximum input, refund, and migration");
  const { wallet, account } = signer();
  if (process.env.AMMORA_READ_RECEIPT?.trim()) throw new Error("Clear AMMORA_READ_RECEIPT before Graduation; this write flow selects fresh confirmed snapshots and must not reuse an earlier creation snapshot");
  const client = await reader();
  const launch = v4Deployment().contracts.launch;
  if (launch.protocolVersion !== 4) throw new Error("this example requires a reviewed V4 deployment");
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, {
    launchFactory: launch.factory,
    feePolicy: launch.feePolicy,
  });

  const snapshot = await readBlock(client);
  const state = await sdk.getStateAtBlock(snapshot.number);
  if (state.status === 3) {
    console.log(`already graduated to ${state.canonicalPool}`);
    return;
  }


  if (state.status !== 1 && state.status !== 2) throw new Error(`Curve status ${state.status} is not active or migration-ready`);

  let dependencyBlock = snapshot.number;
  if (state.status === 1) {
    const quote = await sdk.quoteExactInputAtBlock(maximumQuoteInput, false, snapshot.number);
    const fill = classifyAmmoraV4ExactInputFill(quote, false);
    if (fill.kind !== "graduation-boundary") {
      throw new Error(`this buy is ${fill.kind}, not an executable Graduation boundary`);
    }
    console.log(`requested  ${fill.requestedAmountIn}`);
    console.log(`consumed   ${fill.consumedAmountIn}`);
    console.log(`unused input ${fill.refundableAmountIn}`);

    const plan = await planCurveAtBlock(client, {
      configRegistry: launch.configRegistry, launchFactory: launch.factory,
      graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy,
    }, curve, { blockNumber: snapshot.number, tokenIn: state.quoteToken, amountIn: maximumQuoteInput,
      recipient: account.address, deadline: snapshot.timestamp + 20n * 60n,
      slippageBps: 100, graduationBoundary: true });
    const plannedFill = classifyAmmoraV4ExactInputFill(plan.quote, false);
    if (plannedFill.kind !== "graduation-boundary") {
      throw new Error(`the refreshed plan is ${plannedFill.kind}, not a Graduation boundary`);
    }
    await approve(plan.approvalRequirements, wallet, account, client);
    const fillHash = await send("final curve fill", plan.transaction, wallet, account, client);
    const fillReceipt = await client.getTransactionReceipt({ hash: fillHash });
    dependencyBlock = fillReceipt.blockNumber;
    const confirmedFill = parseAmmoraV4SwapReceipt(fillReceipt, curve, {
      trader: account.address,
      recipient: account.address,
      baseForQuote: false,
      requestedAmountIn: maximumQuoteInput,
      minimumAmountOut: plan.quote.minimumAmountOut,
    });
    console.log(`confirmed  ${confirmedFill.consumedAmountIn}`);
    console.log(`unused input ${confirmedFill.amountLeft}`);
  }

  // Select a new confirmed snapshot only after it includes the successful fill.
  // A lagging RPC never causes a repeated buy; resume status=2 after reconciliation.
  let migrationSnapshot = await readBlock(client);
  if (migrationSnapshot.number < dependencyBlock) {
    // 13 confirmations means the receipt block is at or below head-12.
    const hash = await client.getBlock({ blockNumber: dependencyBlock });
    console.log(`waiting for confirmed snapshot to include final fill block ${dependencyBlock} (${hash.hash})`);
    const deadline = Date.now() + 120_000;
    while (migrationSnapshot.number < dependencyBlock && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      migrationSnapshot = await readBlock(client);
    }
  }
  const migrationBlock = migrationSnapshot.number;
  if (migrationBlock < dependencyBlock) throw new Error(`Final fill confirmed at block ${dependencyBlock}; wait for the reviewed confirmation window, reconcile its hash/nonce, then resume migration only`);
  const migration = await sdk.planMigrateAtBlock(migrationBlock);
  await client.call({
    account: account.address,
    to: migration.transaction.to,
    data: migration.transaction.data,
    blockNumber: migrationBlock,
  });
  const migrationHash = await send("graduate to ARL", migration.transaction, wallet, account, client);
  const migrationReceipt = await client.getTransactionReceipt({ hash: migrationHash });
  const graduated = parseAmmoraV4MigratedReceipt(migrationReceipt, curve);
  console.log(`ARL pool   ${graduated.canonicalPool}`);
});
