import test from "node:test";
import assert from "node:assert/strict";
import { expectedTokenLockClaim } from "../src/token-lock/preflight.js";
import { requirePortableLifecycleAsset } from "../src/portable/asset-model.js";

const owner = "0x1111111111111111111111111111111111111111";
const stranger = "0x2222222222222222222222222222222222222222";
test("Token Lock claim requires its recipient and a positive vested amount", () => {
  assert.equal(expectedTokenLockClaim(owner, owner, 10n, 7n), 7n);
  assert.equal(expectedTokenLockClaim(owner, owner, 10n, 20n), 10n);
  assert.throws(() => expectedTokenLockClaim(stranger, owner, 10n, 1n), /recipient/);
  assert.throws(() => expectedTokenLockClaim(owner, owner, 0n, 1n), /no vested/);
  assert.throws(() => expectedTokenLockClaim(owner, owner, 10n, 0n), /positive/);
});
test("Portable lifecycle accepts SDK034 separate balances and rejects native-only models", () => {
  assert.doesNotThrow(() => requirePortableLifecycleAsset({ kind: "WRAPPED_ERC20", nativeDecimals: 18, wrappedToken: owner, wrappedTokenDecimals: 18, nativeRouter: stranger }));
  assert.throws(() => requirePortableLifecycleAsset({ kind: "NATIVE_ONLY", nativeDecimals: 18, wrappedToken: null, nativeRouter: null }), /shared or wrapped/);
  assert.doesNotThrow(() => requirePortableLifecycleAsset({ kind: "NATIVE_ERC20_INTERFACE", nativeDecimals: 18, erc20Token: owner, erc20Decimals: 18, sharesUnderlyingBalance: true, wrappedToken: null, nativeRouter: null, wrapOperation: "UNSUPPORTED" }));
});
