# Token vesting examples — SDK 0.3.8

Use public SDK **0.3.8** and Math **0.3.0**. Existing launch, revenue, and LP examples remain available; the new CLI is in `src/vesting/`. Commands default to reads or unsigned plans. A send requires `AMMORA_SEND=1`, your own signing wallet, and the reviewed reviewHash.

## 0. First installation

The public examples repository and npm SDK are available without an invitation. Use the repository lockfile or the public Docs source setup; no SDK source build is needed.

Validated with Node **24.18.0**. With nvm, use the repository's `.nvmrc` and `nvm use`.

```sh
curl -fL https://docs.ammora.org/examples/setup.mjs -o ammora-examples-setup.mjs
# Review the setup source, then prepare a new directory
node ammora-examples-setup.mjs ./ammora-examples
cd ammora-examples
node --version
npm ci --ignore-scripts --no-audit --no-fund
cp .env.vesting.example .env
```

`.env.vesting.example` selects chain 91342, auto-route, a 600ms RPC interval, and `AMMORA_SEND=0`. Merge only the settings you need instead of overwriting an existing `.env`. Shell variables take precedence over `.env`; align chain/generation/send values. If `AMMORA_RPC_URL` is empty, the SDK uses its public GIWA RPC. Reads need no key or gas.

The following reads an already-completed public test lock. `completed=true` and `claimable=0` are expected. This address is for observation, not a source of assets you can claim.

```sh
npm run launch:vesting-config -- src/vesting/allocation.example.json
npm run token-lock:inspect -- 0x852Dc7B07361C9bab17024f20F25804502728f07
```

For a separate ESM app, install `npm install --save-exact @ammora-protocol/sdk@0.3.8 viem`. That alone does not add `npm run token-lock:*` commands. The complete [public-package-only sample](https://docs.ammora.org/examples/source/onboarding/vesting-smoke.mjs.txt) runs without relative imports, deployment JSON, or internal environment files. In this examples project, run `node onboarding/vesting-smoke.mjs`. It performs current reads, an unsigned creation plan, and **historical-block reconciliation of an existing claim**; it cannot sign. The public Docs Token vesting quickstart includes the same file.

## 1. Calculate a launch vesting allocation

```sh
npm run launch:vesting-config -- src/vesting/allocation.example.json
```

Calculate the total, cliff, and periodic amounts offline using raw bigint units. The example allocates 100,000 tokens at 9 decimals: a 10,000-token cliff after 90 days, then 12 releases at 30-day intervals. Put the returned `lockedBaseVesting` into a **fully authored Config** and reserve `lockedBaseRaw` separately in the supply budget. Simply appending this amount to an existing Config can break curve/graduation liquidity reconciliation. Pass both values to the Portable Config authoring input as follows.

```ts
import { planAmmoraLaunchVesting, buildPortableAmmoraV4Config } from '@ammora-protocol/sdk';
const vesting = planAmmoraLaunchVesting({ totalAmountRaw: 100_000n * 10n ** 9n,
  cliffUnlockAmountRaw: 10_000n * 10n ** 9n, numberOfPeriods: 12,
  frequencySeconds: 30n * 86_400n, cliffDurationSeconds: 90n * 86_400n });
// Use vesting.config as lockedBaseVesting in your reviewed policy, and supply
// lockedBaseRaw: vesting.totalAmountRaw to buildPortableAmmoraV4Config.
// Keep the existing recipients, complete curve inputs and LP distribution explicit.
```

Remainders are rejected by default. Only `rounding: "cliff"` assigns the remainder to the cliff and reports it. Total duration is limited to 730 days. Launch vesting starts at **the actual graduation transaction timestamp, not token creation**. Existing Config recipients and LP ratios do not change automatically. Follow the [launchpad guide](https://docs.ammora.org/guides/launchpad#atomic-first-buy) for complete Config authoring and atomic first buys.

## 2. Find the lock created by a graduation receipt

```sh
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_SEND=0
npm run launch:vesting-from-graduation -- <curve> <graduationTxHash>
npm run token-lock:inspect -- <lock>
```

To exercise only the read path using an existing public test launch's graduation receipt:

```sh
npm run launch:vesting-from-graduation -- 0x00CB332e63065c600574dE1F6B99BC2662Cec90A 0x5f07fa4dabe896c9a0181ce45dc0f0d0339af326ffe1508cc16ca60e27fbef33
```

This reports **state at the graduation block**, not the currently claimable balance. Substitute your own curve and successful graduation hash for your integration.

Verify GIWA confirmation depth, the canonical block, Core/factory, curve, and Config; correlate `CreatorVestingEscrowed` and `TokenLockCreated` from the same receipt. The lock creator is the Graduation adapter; the recipient is the launch creator. Read current state again before claiming. A launch without vesting correctly fails discovery because those creation events are absent.

If a new lock is hidden by an older snapshot, do not resend creation. Use `AMMORA_READ_RECEIPT=<confirmedCreationHash>` **for reads only**, or wait for confirmation depth. Clear it for a new creation/claim plan.

## 3. Create standalone team or investor vesting

Author `create.json` with the following shape, choosing your own addresses, start time, and salt. The token must be supported by GIWA Token Policy, and the caller must hold the full amount. Actual sends also require GIWA ETH for gas. Arbitrary ERC20s are not automatically supported.

```json
{
  "token": "<supported token address>",
  "recipient": "<beneficiary address>",
  "vestingStartTime": "<absolute Unix seconds>",
  "allocation": {
    "totalAmountRaw": "1000", "cliffUnlockAmountRaw": "100",
    "numberOfPeriods": 3, "frequencySeconds": "86400",
    "cliffDurationSeconds": "604800", "rounding": "reject"
  },
  "userSalt": "<unique 32-byte hex>",
  "metadataHash": "<32-byte hex>"
}
```

The following generator fills every field. Set `VESTING_TOKEN` and `VESTING_RECIPIENT` to your supported token and recipient. The example uses **1000 raw**, not 1000 human-readable tokens. It starts one hour after the current Unix time, has a cliff seven days later, then three releases one day apart. Review amounts and schedule before sending; do not pass millisecond `Date.now()` directly.

```sh
node --input-type=module <<'NODE'
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const token = process.env.VESTING_TOKEN;
const recipient = process.env.VESTING_RECIPIENT;
if (![token, recipient].every(v => /^0x[0-9a-fA-F]{40}$/.test(v ?? ''))) {
  throw new Error('Set VESTING_TOKEN and VESTING_RECIPIENT to real addresses');
}
writeFileSync('create.json', JSON.stringify({ token, recipient,
  vestingStartTime: String(Math.floor(Date.now() / 1000) + 3600),
  allocation: { totalAmountRaw: '1000', cliffUnlockAmountRaw: '100',
    numberOfPeriods: 3, frequencySeconds: '86400', cliffDurationSeconds: '604800', rounding: 'reject' },
  userSalt: '0x' + randomBytes(32).toString('hex'),
  metadataHash: '0x' + '0'.repeat(64),
}, null, 2) + '\n', { flag: 'wx' });
NODE
```

The generator will not overwrite `create.json`. Do not reuse the salt of a created lock.

```sh
export AMMORA_ACCOUNT=<funding-wallet>
export AMMORA_READ_RECEIPT=''
npm run token-lock:create -- create.json
# Review recipient, total, schedule, target, calldata and reviewHash first.
AMMORA_SEND=1 npm run token-lock:create -- create.json <reviewHash>
```

This creates a **non-revocable lock with an immutable recipient**. It does not automatically select another actor mode. `APPROVAL_REQUIRED` sends **one ERC20 approval only**. A different existing allowance may first require resetting to zero. After confirmation, preview again and review the new reviewHash; approval and creation are separate actions. For `READY`, verify predicted address, salt, recipient, and schedule from the creation receipt and read the funded lock. Used salts are rejected. Approval success alone does not mean a lock exists.

The current GIWA factory funding path is **creator → factory → lock**. Reconcile both Transfers in the same receipt and actual block balances, rather than expecting a single creator→lock Transfer. The exact approval used in validation was consumed by creation, and no tokens remained in the factory.

## 4. Claim as the recipient

```sh
export AMMORA_ACCOUNT=<beneficiary-wallet>
npm run token-lock:inspect -- <lock>
npm run token-lock:claim-verified -- <lock> <maximumRaw>
AMMORA_SEND=1 npm run token-lock:claim-verified -- <lock> <maximumRaw> <reviewHash>
```

Verify the caller is the recipient and current claimable is positive. The claim maximum is fixed to the previewed amount. Verify `TokensClaimed` and the actual balance increase between the surrounding blocks. Other transfers in the same block may cause conservative rejection; reconcile that hash instead of automatically resending. Existing `token-lock:claim` remains the older low-level example with a manual runtime pin; use `claim-verified` for new integrations.

Only for an actual send, supply your own test wallet's key locally through `AMMORA_PRIVATE_KEY`. `AMMORA_ACCOUNT` is the plan's caller and must match the key-derived address. The funding wallet signs creation; the actual lock recipient signs claims. Web services should pass `plan.transaction` to a connected wallet instead of collecting private keys. Persist creation/claim hashes, confirm them, then call SDK receipt parsers. A parser failure can occur after a successful transaction; reconcile hash, nonce, and canonical receipt first.

## 5. Use public SDK ALMM readiness

Run the existing commands in the [ALMM guide](https://docs.ammora.org/guides/almm-preset).

```sh
npm run stablecoin:check-almm-preset -- <reviewed-manifest.json> <preset-request.json>
npm run stablecoin:check-almm-position -- <reviewed-manifest.json> <pool> <tokenId>
```

The compatibility module path remains, but it re-exports public SDK `getALMMPresetReadiness`, `getALMMPositionReadiness`, and `hashALMMPreset`. New stablecoin plans use SDK 0.3.8; replan and review stored 0.3.7 send plans. Historical execution evidence remains in separate original snapshots. Default factory/preset, fee settings, and LP authority are unchanged.

## Validation scope

Read [current validation](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) before using historical test targets.

## Troubleshooting

| Message / state | Check |
| --- | --- |
| Missing `AMMORA_ACCOUNT` | Use the funding address for create and recipient for claim; an address alone does not grant signing authority |
| `unsupported token` / `insufficient token balance` | Check GIWA Token Policy and the caller's ERC20 balance; SDK installation supplies neither support nor funds |
| `APPROVAL_REQUIRED` | Pre-creation stage: send one exact approval, then preview again; approval does not create a lock |
| `nothing to claim` | Completed sample, pre-cliff, or zero claimable; inspect current state and do not resend a successful transaction |
| reviewHash mismatch | Allowance, balance, claim amount, or inputs changed; review a fresh preview and hash |
| RPC 429 / transient read failure | Increase pacing or change provider; reconcile existing hash, nonce, and receipt without automatic resend |

The [validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) separates public package installation, Linux checks, current/historical block verification, deployment status, and access limits.
