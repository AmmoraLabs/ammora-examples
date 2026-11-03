import { AmmoraTokenLockClient, giwaSepoliaTokenLockDeployment, giwaSepoliaAutoRoute, resolveAmmoraFinalizedHead } from "@ammora-protocol/sdk";
import { type Hex, type PublicClient } from "viem";
import { reader, readBlock } from "../shared/env.js";
export async function context(mutation = false) {
  if (process.env.AMMORA_CHAIN_ID !== "91342") throw new Error("The bundled TokenLock example supports GIWA Sepolia 91342 only");
  if (mutation && process.env.AMMORA_READ_RECEIPT?.trim()) throw new Error("Clear AMMORA_READ_RECEIPT before planning a new transaction");
  const client = await reader(), block = await readBlock(client);
  return { client, block, locks: new AmmoraTokenLockClient(client, giwaSepoliaTokenLockDeployment) };
}
export async function confirmedReceipt(client: PublicClient, hash: Hex) {
  if (client.chain?.id !== 91342 || await client.getChainId() !== 91342) throw new Error("GIWA chain required");
  const receipt = await client.getTransactionReceipt({ hash });
  const head = await resolveAmmoraFinalizedHead([client], giwaSepoliaAutoRoute.finality);
  if (receipt.transactionHash !== hash || receipt.status !== "success" || receipt.blockNumber > head) throw new Error("Receipt failed or lacks confirmations; reconcile existing hash before any resend");
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  if (block.hash !== receipt.blockHash) throw new Error("Receipt is no longer canonical");
  return { receipt, block };
}
