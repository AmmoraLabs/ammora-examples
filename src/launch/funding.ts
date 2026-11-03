/** Read only. npm run launch:funding -- <configId> <wallet> [humanNativeToWrap] */
import { getAmmoraV4ConfigAtBlock, verifyAmmoraV4CoreAtBlock } from "@ammora-protocol/sdk";
import { erc20Abi } from "viem";
import { address, readBlock, reader, v4Deployment } from "../shared/env.js";
import { printJson, rawAmount } from "../shared/input.js";
import { main } from "../shared/run.js";
import { previewQuoteWrap } from "./funding-plan.js";

main(async () => {
  const [id, walletArg, humanAmount, ...extra] = process.argv.slice(2);
  if (!walletArg || extra.length) throw new Error("usage: <configId> <wallet> [humanNativeToWrap]");
  const configId = rawAmount(id, "configId");
  const wallet = address("AMMORA_FUNDING_WALLET", walletArg);
  const client = await reader();
  const deployment = v4Deployment();
  const launch = deployment.contracts.launch;
  const block = await readBlock(client);
  await verifyAmmoraV4CoreAtBlock(client, { configRegistry: launch.configRegistry, launchFactory: launch.factory, graduationAdapter: launch.graduationAdapter, feePolicy: launch.feePolicy }, block.number);
  const template = await getAmmoraV4ConfigAtBlock(client, launch.configRegistry, configId, block.number);
  const quoteToken = template.config.quoteToken;
  const quoteDecimals = await client.readContract({ address: quoteToken, abi: erc20Abi, functionName: "decimals", blockNumber: block.number });
  const quoteBalance = await client.readContract({ address: quoteToken, abi: erc20Abi, functionName: "balanceOf", args: [wallet], blockNumber: block.number });
  const nativeBalance = await client.getBalance({ address: wallet, blockNumber: block.number });
  const wrappedNative = deployment.contracts.tokens.wrappedNative;
  const wrap = humanAmount === undefined ? null : previewQuoteWrap({ quoteToken, wrappedNative, quoteDecimals,
    nativeDecimals: deployment.chain.nativeCurrency.decimals, nativeRouter: deployment.contracts.routers.native,
    nativeBalance, humanAmount });
  printJson({ chainId: deployment.chain.id, slot: deployment.slot, registry: launch.configRegistry,
    configId, configHash: template.configHash, enabled: template.enabled, wallet,
    blockNumber: block.number, blockHash: block.hash, snapshot: block.snapshot,
    nativeBalanceRaw: nativeBalance, nativeDecimals: deployment.chain.nativeCurrency.decimals,
    quoteToken, quoteDecimals, quoteBalanceRaw: quoteBalance,
    quoteIsWrappedNative: quoteToken.toLowerCase() === wrappedNative.toLowerCase(), wrap,
    note: "Read-only funding snapshot and optional SDK wrap calldata, not simulation or a send. Native gas balance and quote ERC-20 balance are separate. Reserve enough native currency for estimated gas; leaving a positive remainder alone does not prove gas sufficiency. Wrapping is separate from native-router swap eligibility. Submit only through the connected wallet after fresh checks, simulation and user review.",
  });
});
