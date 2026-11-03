import { parseAbi } from "viem";
import { DFSClient } from "@ammora-protocol/sdk";
import { address, clientOptions, deployment, reader } from "../shared/env.js";
import { caller } from "../shared/actions.js";
export const dfs = async (argument: string | undefined) => {
  const vault = address("DFS_VAULT", argument), account = caller();
  const client = await reader();
  const registered = await client.readContract({ address: deployment().contracts.feeSharing.factory,
    abi: parseAbi(["function isVault(address vault) view returns (bool)"]), functionName: "isVault", args: [vault] });
  if (!registered) throw new Error("Reviewed DFS factory did not create this vault");
  const sdk = new DFSClient(client, vault, clientOptions());
  return { sdk, client, caller: account, vault, allowedTargets: [vault] };
};
