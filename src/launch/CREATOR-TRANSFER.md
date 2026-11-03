# Transfer Creator authority

```sh
AMMORA_SEND=0 npm run launch:transfer-creator -- CURVE NEW_CREATOR
```

Only the current creator can execute, **before migration**. Zero and unchanged creator addresses are rejected. After `planTransferCreator` passes state/authority checks, compare its calldata with `buildTransferCreator` and use only the single simulated transaction. The default preview does not transfer authority.

Verify that the destination wallet/contract can control creator authority. A real transfer takes effect immediately; reversing it requires the new creator. Reconcile old/new metadata rights, future fee attribution, and previously accrued FeeVault claims separately. Existing entitlements do not automatically move to the new wallet.

This does not change Config owner or Partner recipient. Do not use it to alter existing third-party launches or curated recipients. Review the [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).
