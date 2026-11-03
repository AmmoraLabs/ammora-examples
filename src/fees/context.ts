import { ammoraLaunchFactoryV4Abi, feeVaultAbi, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { parseAbi, zeroAddress } from "viem";
import { caller } from "../shared/actions.js";
import { reader, readBlock, v4Deployment } from "../shared/env.js";
import { nonzero } from "./policy.js";

/** Accept only FeeVaults named by the reviewed launch/ARL factories, and preserve their existing deployment-specific owner. */
export async function feeVaultContext(argument: unknown) {
  const vault = nonzero(argument, "feeVault"), account = caller(), client = await reader();
  const launch = v4Deployment().contracts.launch, { number: blockNumber } = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: launch.configRegistry, launchFactory: launch.factory,
    graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy }, blockNumber);
  const factories = [launch.factory, launch.concentratedFactory, launch.compoundingFactory];
  const bindings = await Promise.all(factories.map(async factory => ({ factory, vault: await client.readContract({
    address: factory, abi: ammoraLaunchFactoryV4Abi, functionName: "feeVault", blockNumber,
  }) })));
  const binding = bindings.find(item => item.vault.toLowerCase() === vault.toLowerCase());
  if (!binding) throw new Error("FeeVault is not bound to a reviewed factory");
  const owner = await client.readContract({ address: vault, abi: parseAbi(["function owner() view returns(address)"]), functionName: "owner", blockNumber });
  if (owner === zeroAddress) throw new Error("FeeVault has no owner");
  // The launch vault was deployed with an EOA owner; ARL factories own their own vaults.
  // The verified Factory getter binds identity. Never change an owner to fit a constructor assumption.
  return { client, vault, caller: account, blockNumber, factory: binding.factory, owner, abi: feeVaultAbi, allowedTargets: [vault] };
}
