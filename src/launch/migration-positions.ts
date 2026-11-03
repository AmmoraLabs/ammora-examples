/** Resolve all Graduation NFTs, including rounding dust, from one canonical receipt.
 * npm run launch:migration-positions -- <curve> <migrationHash> */
import {
  AMMORA_FEE_POLICY_VERSION, AmmoraV4LaunchCurveClient,
  ammoraLaunchFactoryV4Abi, ammConcentratedPositionManagerV3Abi,
  giwaSepoliaAutoRoute, resolveAmmoraFinalizedHead,
  parseAmmoraV4MigratedReceipt, resolveAmmoraV4ConcentratedMigrationPositionsReceipt,
  verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { zeroAddress, type Hex } from "viem";
import { address, reader, v4Deployment } from "../shared/env.js";
import { printJson } from "../shared/input.js";
import { main } from "../shared/run.js";

main(async () => {
  const [curveArg, hashArg, ...extra] = process.argv.slice(2);
  const curve = address("AMMORA_LAUNCH_CURVE", curveArg);
  if (!hashArg || !/^0x[0-9a-fA-F]{64}$/.test(hashArg) || extra.length) throw new Error("usage: <curve> <migrationHash>");
  const hash = hashArg as Hex;
  const client = await reader();
  if (client.chain?.id !== giwaSepoliaAutoRoute.chainId) throw new Error("No reviewed confirmation policy for this chain");
  const receipt = await client.getTransactionReceipt({ hash });
  const confirmedHead = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);
  if (receipt.status !== "success" || confirmedHead < receipt.blockNumber) throw new Error("Migration is reverted or outside the confirmed snapshot; reconcile and wait before continuing");
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (block.hash !== receipt.blockHash) throw new Error("Migration receipt is not canonical");
  const launch = v4Deployment().contracts.launch;
  const core = { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy };
  await verifyAmmoraV4CoreAtBlock(client, core, receipt.blockNumber);
  const state = await new AmmoraV4LaunchCurveClient(client, curve, core).getStateAtBlock(receipt.blockNumber);
  const token = await client.readContract({ address: launch.factory, abi: ammoraLaunchFactoryV4Abi, functionName: "tokenForCurve", args: [curve], blockNumber: receipt.blockNumber });
  if (token === zeroAddress || token.toLowerCase() !== state.baseToken.toLowerCase()
    || state.feePolicy.toLowerCase() !== launch.feePolicy.toLowerCase()
    || state.feePolicyVersion !== AMMORA_FEE_POLICY_VERSION || state.status !== 3) throw new Error("Curve is not graduated under the selected factory and fee policy");
  const migrated = parseAmmoraV4MigratedReceipt(receipt, curve);
  if (migrated.canonicalPool.toLowerCase() !== state.canonicalPool.toLowerCase()) throw new Error("Migration event and curve disagree on canonical pool");
  const resolved = resolveAmmoraV4ConcentratedMigrationPositionsReceipt({ chainId: client.chain.id, receipt, expectedTransactionHash: hash, curve, positionManager: launch.concentratedPositionManager, canonicalPool: migrated.canonicalPool, creator: state.creator, partner: state.partnerRecipient });
  const positions = [];
  for (const position of resolved.positions) {
    const storage = await client.readContract({ address: launch.concentratedPositionManager, abi: ammConcentratedPositionManagerV3Abi, functionName: "getPosition", args: [position.tokenId], blockNumber: receipt.blockNumber });
    const owner = await client.readContract({ address: launch.concentratedPositionManager, abi: ammConcentratedPositionManagerV3Abi, functionName: "ownerOf", args: [position.tokenId], blockNumber: receipt.blockNumber });
    if (owner.toLowerCase() !== position.owner.toLowerCase() || storage.pool.toLowerCase() !== migrated.canonicalPool.toLowerCase()) throw new Error("Position receipt and storage identity differ");
    positions.push({ ...position, storage });
  }
  printJson({ ...resolved, positions, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, confirmedHead,
    note: "Receipt-time ownership, not current claim permission. Include every NFT: integer rounding can mint a separate dust position. No permanent-lock event alone is not proof of unlocked state; inspect storage. Shared creator/partner ownership prevents distinct role attribution per NFT. Revalidate ownership and pool bindings before claiming.",
  });
});
