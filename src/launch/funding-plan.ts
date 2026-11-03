import { buildAmmoraPortableWrapTransaction } from "@ammora-protocol/sdk";
import type { Address } from "viem";
import { tokenAmount } from "../shared/input.js";

export const previewQuoteWrap = (input: {
  quoteToken: Address; wrappedNative: Address; quoteDecimals: number; nativeDecimals: number;
  nativeRouter: Address; nativeBalance: bigint; humanAmount: string;
}) => {
  if (input.quoteToken.toLowerCase() !== input.wrappedNative.toLowerCase()) throw new Error("Config quote asset is not this deployment's wrapped native token; obtain that ERC-20 directly");
  if (input.quoteDecimals !== input.nativeDecimals) throw new Error("wrapped/native decimal mismatch; use a separately reviewed asset model");
  const amount = tokenAmount(input.humanAmount, input.nativeDecimals);
  if (amount >= input.nativeBalance) throw new Error("wrapping would leave no native balance for gas, or exceed the balance");
  return { amountRaw: amount, transaction: buildAmmoraPortableWrapTransaction({
    kind: "WRAPPED_ERC20", nativeDecimals: input.nativeDecimals, wrappedToken: input.wrappedNative,
    wrappedTokenDecimals: input.quoteDecimals, nativeRouter: input.nativeRouter,
  }, amount) };
};
