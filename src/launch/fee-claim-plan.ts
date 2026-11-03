import { buildClaimFeeVaultFor } from "@ammora-protocol/sdk";
import type { Address } from "viem";

/** The connected account owns the claim; a payout address never selects a beneficiary. */
export const planOwnFeeClaim = (
  token: Address,
  account: Address,
  recipient: Address = account,
) => buildClaimFeeVaultFor(token, account, recipient);
