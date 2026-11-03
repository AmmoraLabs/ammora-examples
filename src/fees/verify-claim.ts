/** npm run fees:verify-claim -- <launch|dfs> <hash> <vault> <token> <beneficiary> <payout> [index]
 * Read-only, including when AMMORA_SEND=1. Never loads a signer or constructs a new transaction.
 * This command covers direct beneficiary claims; use the LP verifier for LP/delegate receipts.
 */
import { ammoraLaunchFactoryV4Abi, ammoraAFSVaultAbi } from "@ammora-protocol/sdk";
import { parseAbi, type Hash } from "viem";
import { address, deployment, reader, v4Deployment } from "../shared/env.js";
import { integer, printJson } from "../shared/input.js";
import { main } from "../shared/run.js";
import { verifyFeePayment } from "../shared/fee-payment.js";

main(async () => {
  const [kind, hash, vaultArg, tokenArg, beneficiaryArg, payoutArg, indexArg] = process.argv.slice(2);
  if (kind !== "launch" && kind !== "dfs") throw new Error("kind must be launch or dfs");
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? "")) throw new Error("hash must be a submitted transaction hash");
  const vault = address("FEE_VAULT", vaultArg), token = address("FEE_TOKEN", tokenArg);
  const beneficiary = address("BENEFICIARY", beneficiaryArg), payout = address("PAYOUT", payoutArg);
  const index = kind === "dfs" ? integer(indexArg ?? "", "recipientIndex", 0, 255) : undefined;
  const client = await reader();
  const receipt = await client.getTransactionReceipt({ hash: hash as Hash });
  const blockNumber = receipt.blockNumber;
  // Provenance is checked at the claim block, never inferred from untrusted event addresses.
  if (kind === "launch") {
    const reviewed = await client.readContract({ address: v4Deployment().contracts.launch.factory,
      abi: ammoraLaunchFactoryV4Abi, functionName: "feeVault", blockNumber });
    if (reviewed.toLowerCase() !== vault.toLowerCase()) throw new Error("Vault differs from reviewed launch factory");
  } else {
    const registered = await client.readContract({ address: deployment().contracts.feeSharing.factory,
      abi: parseAbi(["function isVault(address) view returns (bool)"]), functionName: "isVault", args: [vault], blockNumber });
    if (!registered) throw new Error("Reviewed DFS factory did not create this vault");
    const actualToken = await client.readContract({ address: vault, abi: ammoraAFSVaultAbi, functionName: "token", blockNumber });
    if (actualToken.toLowerCase() !== token.toLowerCase()) throw new Error("Token differs from DFS vault token");
  }
  printJson(await verifyFeePayment(client, { kind, hash: hash as Hash, vault, token, beneficiary, payout, index }));
});
