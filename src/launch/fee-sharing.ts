/** Read a Config's fee policy, beneficiaries and illustrative splits. No key required.
 * npm run launch:fee-sharing -- <configId> [beneficiary]
 * FeeVault claimable is keyed by fee asset (usually quote/WETH), not launch identity. */
import {
  ammoraLaunchFactoryV4Abi, feeVaultAbi, getAmmoraV4ConfigAtBlock,
  getAmmoraProtocolFeePolicyV1, assertAmmoraProtocolFeePolicyV1,
  previewAmmoraLaunchFeeDistribution, previewAmmoraGraduatedFeeDistribution,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { address, readBlock, reader, v4Deployment } from "../shared/env.js";
import { main } from "../shared/run.js";
import { printJson, rawAmount } from "../shared/input.js";

main(async () => {
  const [id, beneficiaryArg, ...extra] = process.argv.slice(2);
  if (!id || extra.length) throw new Error("usage: <configId> [beneficiary]");
  const configId = rawAmount(id, "configId");
  const beneficiary = beneficiaryArg ? address("AMMORA_FEE_BENEFICIARY", beneficiaryArg) : undefined;
  const client = await reader();
  const deployment = v4Deployment();
  const launch = deployment.contracts.launch;
  const block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy }, block.number);
  const entry = await getAmmoraV4ConfigAtBlock(client, launch.configRegistry, configId, block.number);
  const policy = await getAmmoraProtocolFeePolicyV1(client, launch.feePolicy, block.number);
  assertAmmoraProtocolFeePolicyV1(policy);
  const feeVault = await client.readContract({ address: launch.factory, abi: ammoraLaunchFactoryV4Abi, functionName: "feeVault", blockNumber: block.number });
  const claimableQuote = beneficiary ? await client.readContract({ address: feeVault, abi: feeVaultAbi, functionName: "claimable", args: [entry.config.quoteToken, beneficiary], blockNumber: block.number }) : null;
  printJson({ slot: deployment.slot, registry: launch.configRegistry, configId, configHash: entry.configHash, enabled: entry.enabled, blockNumber: block.number, blockHash: block.hash, snapshot: block.snapshot,
    policy, feeVault, configOwner: entry.identity.owner, feeClaimer: entry.identity.feeClaimer,
    partnerRecipient: entry.config.partnerRecipient, quoteToken: entry.config.quoteToken,
    creatorShareOfNonProtocolBps: entry.config.creatorShareOfNonProtocolBps,
    feeSchedule: { cliffFeeBps: entry.config.cliffFeeBps, periods: entry.config.feeNumberOfPeriods, frequency: entry.config.feePeriodFrequency, reductionBps: entry.config.feeReductionFactorBps, mode: entry.config.feeSchedulerMode, dynamicFeeEnabled: entry.config.dynamicFeeEnabled, rateLimiterEnabled: entry.config.rateLimiterEnabled },
    illustrativeFeeRaw: 10_000n,
    launchSplitWithoutReferral: previewAmmoraLaunchFeeDistribution(10_000n, entry.config.creatorShareOfNonProtocolBps, false),
    launchSplitWithReferral: previewAmmoraLaunchFeeDistribution(10_000n, entry.config.creatorShareOfNonProtocolBps, true),
    graduatedSplitWithoutReferral: previewAmmoraGraduatedFeeDistribution(10_000n, entry.config.postMigrationCompoundingFeeBps, false),
    migrationQuoteFeeBps: entry.config.migrationQuoteFeeBps,
    creatorMigrationFeeShareBps: entry.config.creatorMigrationFeeShareBps,
    liquidityDistribution: entry.config.liquidityDistribution,
    beneficiary: beneficiary ?? null, claimableQuoteRaw: claimableQuote,
    note: "Illustrations split a fee amount, not trade notional. Creator is the launch creator, not necessarily Config owner. Graduation pays creator/partner through LP positions. Vault balances aggregate all sources for each asset/beneficiary; use trade events for per-launch accounting. AFS vaults are optional and are not created or funded by this Config.",
  });
});
