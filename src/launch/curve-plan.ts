import {
  AMMORA_FEE_POLICY_VERSION, AmmoraV4LaunchCurveClient,
  ammoraLaunchFactoryV4Abi, ammoraLaunchPoolV4Abi,
  classifyAmmoraV4ExactInputFill, verifyAmmoraV4CoreAtBlock,
} from "@ammora-protocol/sdk";
import { encodeFunctionData, zeroAddress, type Address, type PublicClient } from "viem";

/** Explicit-block V4 planning for SDK 0.3.0, whose convenience swap planner selects
 * latest internally. Authentication and quotes stay at the caller's reviewed block;
 * execution must still simulate against current state and enforce minimum output. */
export const planCurveAtBlock = async (
  client: PublicClient,
  core: { configRegistry: Address; launchFactory: Address; graduationAdapter: Address; feePolicy: Address },
  curve: Address,
  parameters: { blockNumber: bigint; tokenIn: Address; amountIn: bigint; recipient: Address; deadline: bigint; slippageBps: number; graduationBoundary?: boolean },
) => {
  if (parameters.amountIn <= 0n || !Number.isSafeInteger(parameters.slippageBps) || parameters.slippageBps < 0 || parameters.slippageBps > 1000) throw new Error("positive input and slippage from 0 to 1000 bps required");
  const blockNumber = parameters.blockNumber;
  await verifyAmmoraV4CoreAtBlock(client, core, blockNumber);
  const sdk = new AmmoraV4LaunchCurveClient(client, curve, core);
  const state = await sdk.getStateAtBlock(blockNumber);
  const factoryToken = await client.readContract({ address: core.launchFactory, abi: ammoraLaunchFactoryV4Abi, functionName: "tokenForCurve", args: [curve], blockNumber });
  if (factoryToken === zeroAddress || factoryToken.toLowerCase() !== state.baseToken.toLowerCase()
    || state.feePolicy.toLowerCase() !== core.feePolicy.toLowerCase()
    || state.feePolicyVersion !== AMMORA_FEE_POLICY_VERSION) throw new Error("curve is not bound to the reviewed V4 factory and fee policy");
  if (state.status !== 1) throw new Error(`Curve status ${state.status} is not active`);
  const baseForQuote = parameters.tokenIn.toLowerCase() === state.baseToken.toLowerCase();
  if (!baseForQuote && parameters.tokenIn.toLowerCase() !== state.quoteToken.toLowerCase()) throw new Error("tokenIn is not a curve asset");
  const quote = await sdk.quoteExactInputAtBlock(parameters.amountIn, baseForQuote, blockNumber);
  const fill = classifyAmmoraV4ExactInputFill(quote, baseForQuote);
  const boundary = parameters.graduationBoundary === true;
  if (boundary ? fill.kind !== "graduation-boundary" : fill.kind !== "full") throw new Error(`Unexpected ${fill.kind}; ordinary orders must fill in full and graduation buys must reach the boundary`);
  const minimumAmountOut = quote.amountOut * BigInt(10_000 - parameters.slippageBps) / 10_000n;
  if (minimumAmountOut === 0n) throw new Error("minimum output rounds to zero");
  return {
    state, quote: { ...quote, minimumAmountOut }, fill, baseForQuote,
    tokenOut: baseForQuote ? state.quoteToken : state.baseToken,
    transaction: { to: curve, data: encodeFunctionData({ abi: ammoraLaunchPoolV4Abi, functionName: "swapExactInput", args: [parameters.amountIn, minimumAmountOut, baseForQuote, boundary, parameters.recipient, parameters.deadline] }) },
    approvalRequirements: [{ token: parameters.tokenIn, spender: curve, amount: parameters.amountIn }],
  };
};
