# Stablecoin partner quickstart — GIWA

**Follow this one guide from wallets and funding → asset review → token policy registration → pools and LP → trading → fee claims.** Connect ERC20 assets already issued on GIWA. No Launch token reissuance or graduation is required.

Target **GIWA Sepolia 91342** with the explicit opt-in profile **`giwa-almm-unified-v1`**. Use public SDK **0.3.9** with official fee-routing exports from `@ammora-protocol/sdk`. The retained [import path](https://docs.ammora.org/examples/source/extensions/almm-unified/fee-claims-compat.ts.txt) only re-exports the SDK; install the public npm package and retain the reviewed GIWA profile. The [profile JSON](https://docs.ammora.org/examples/source/extensions/almm-unified/giwa-profile.json.txt) separates protocol configuration from assets. Do not copy its synthetic test tokens, Ammora wallets or existing NFTs into partner configuration.

## Approval and review boundaries

A partner can use an already supported pair and ready pool/preset without per-partner Ammora approval. For an unclassified standard ERC20 with no owner override, the selected Registry's small exact-transfer registration probe is self-service. It does not require making the issuer's wallet or issuance gate a registrar and does not grant aggregation admission.

An owner policy blocking the requested operation or needing a change, unsupported token behavior, a new preset/deployment and actual issuer controls require their designated owner/issuer review. Fee delegation comes from the actual feeOwner, not automatically from the issuer or NFT owner. See [partner permissions](PERMISSIONS.md) and section 4 below; test success does not certify official issuer assets or mainnet.

## 1. Prepare wallets and funds

| Role | Responsibilities | Requirements |
| --- | --- | --- |
| Issuer contact | Supplies official token addresses and mint/upgrade/pause/blacklist control evidence | GIWA addresses, decimals, source/deployment and control review for both assets |
| LP operating wallet | Deposits, withdraws and manages NFTs; default feeOwner | Both ERC20 balances and native gas ETH; small ERC20 amounts for registration probes |
| Actual feeOwner | Claims fees and grants/revokes executor authority | Gas ETH if an EOA signs directly; may differ from the LP owner |
| Fee claim wallet (optional) | Claims only fees authorized by feeOwner | Separate delegation and gas ETH; no principal/NFT authority |
| Payout | Receives fees | ERC20-compatible address; no signing or gas required |
| Registry owner | Reviews/changes owner-defined asset policies | Coordinate separately with Ammora when needed; the issuer does not need this administrative role |

The simplest setup is **LP wallet = feeOwner**, a separate payout and an optional separate claim wallet. Being an issuer admin or recipient does not confer LP fee authority. ETH and WETH balances are distinct; a WETH pair needs both ERC20 WETH and gas ETH. Use partner-reviewed funding, price, fee and withdrawal budgets.

## 2. Install and configure common commands

Use the complete repository with Node 22 or 24. Never paste keys into code. The EOA executor reads process `AMMORA_PRIVATE_KEY` only when sending; inject it into memory through your secure signer/secret loader. Do not put keys in command arguments, source, JSON, logs or client environment files.

```bash
curl -fL https://docs.ammora.org/examples/setup.mjs -o ammora-examples-setup.mjs
# Review the setup source, then prepare a new directory
node ammora-examples-setup.mjs ./ammora-examples
cd ammora-examples
npm ci --ignore-scripts
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_RPC_URL=https://sepolia-rpc.giwa.io
export AMMORA_RPC_INTERVAL_MS=600
export AMMORA_READ_RECEIPT=''
export AMMORA_SEND=0
export D=.validation/stablecoin-quickstart
mkdir -p "$D"
export M="$D/partner.json"
```

`AMMORA_READ_RECEIPT` pins reads to a historical receipt block. **Leave it empty for new plans.** `AMMORA_ACCOUNT` is the actual caller for the operation; start with the LP wallet.

```bash
export AMMORA_ACCOUNT=REPLACE_WITH_LP_ADDRESS
plan() {
  AMMORA_SEND=0 npx --no-install tsx extensions/almm-unified/plan.ts "$1" "$M" "$2" "$3"
}
send() {
  AMMORA_SEND=1 AMMORA_UNIFIED_REVIEW_HASH="$2" \
    npx --no-install tsx extensions/almm-unified/execute.ts "$1"
}
```

`plan OPERATION REQUEST OUTPUT` creates an unsigned plan. Review `caller`, `transactions[].to/data/value`, amounts, approvals, recipient and `reviewHash` before running `send PLAN REVIEWED_HASH`. Replace `REPLACE_...` and `REVIEWED_HASH` with actual reviewed values. Do not send inspect/discover or transaction-free no-op plans.

The executor checks current-state replanning, exact calldata, nonce, simulation and gas limits, then sends one transaction at a time. A successful/unknown hash or `.validation/almm-unified/<caller>-<nonce>.json` requires hash/receipt/canonical-block reconciliation first. Do not send concurrently from one wallet or resend successful transactions. Smart accounts execute unsigned `to/data/value` through a reviewed executor; do not substitute another key into the EOA sender.

## 3. Write the partner asset and role manifest

This command creates an **unreviewed draft**, not approval or completed review. It adapts the default ARL template to this profile's ALMM inputs.

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync('src/stablecoin/manifests/native-issuer.template.json'));
m.id = 'my-stablecoin-giwa-pilot';
m.model = 'almm';
delete m.deployment;
m.policy.maxFeeBps = 1;
fs.writeFileSync(process.env.M, JSON.stringify(m, null, 2) + '\n', { flag: 'wx' });
JS
```

Edit `$M` with your partner's data. Empty addresses, `pending` or `unreviewed` values block execution.

| Field | Required value |
| --- | --- |
| `origin` | `kind:"native-issuer"`, actual issuer and GIWA test-support evidence; set `status:"reviewed"` after review |
| `base`, `quote` | Official GIWA addresses, decimals (0–18) and reviewed runtime `codeHash`; **use the lower-address asset as base**, and review budgets and quote/base price in that order |
| Asset `proxy` | Actual immutable status or supported EIP1967 implementation/code hash/admin; do not bypass unreviewed, custom or beacon forms |
| Asset `review` | Source/deployment evidence and mint/burn/upgrade/pause/blacklist authorities; actual ABI-compatible `owner()` or `hasRole()` entries; different getters require integration review |
| `roles.liquidityOwner` | LP operating wallet |
| `roles.payout` | Actual fee payout; do not use pool/protocol/token contracts as recipients |
| `roles.feeDelegate` | Separate claim wallet or `null`; when identical to feeOwner, claim directly without a separate grant |
| Optional `roles.feeOwner` | Separate fee owner for this ALMM extension; omit for ordinary LP; see below |
| `policy` | Actual raw input caps, slippage, price deviation, net execution cost, gas and TTL limits; template `1 raw` values are placeholders |
| `reference` | Independent price evidence, actual observation UNIX timestamp and validity period; `quotePerBase` means quote units per one base |

`pausedGetter`/`blacklistGetter:false` and empty authorities arrays do not prove absence of controls. Review actual source and issuer interfaces. Do not certify a pool's peg using its own spot price or merely refresh the observation timestamp. Both assets must be reviewed exact-transfer ERC20s; fee-on-transfer, rebasing and unreviewed callback assets are outside this scope. Share assets such as stcUSD are not 1:1 cUSD without separate conversion/redemption review.

## 4. Check and register policy at the selected Factory

Use the same `plan` / `send` commands for registration. `policy`, `register-approve` and `register` verify the **selected unified profile's Factory → Registry binding**, asset runtimes and controls. Do not mix in a different Registry from the default catalog.

```bash
printf '{}\n' > "$D/policy.request.json"
plan policy "$D/policy.request.json" "$D/policy.before.json"
```

Review `summary.registry`, `summary.assets[].policy`, `ownerConfigured` and `poolSupported`. `policy` is read-only; do not send it.

| State | Next step |
| --- | --- |
| `poolSupported:true` | Already supported; continue without registration |
| `kind=0`, `ownerConfigured:false` | Eligible for the small exact-transfer round trip below |
| Owner policy blocks pool use or needs a change | Preserve policy and consult Registry owner; a probe cannot overwrite it. If pool use is already supported, continue without new approval |
| Pause/blacklist, changed code/authority or unsupported token behavior | Resolve the cause and issuer requirements first |

Create the following requests **only for the unregistered asset**, separately for base and quote as needed. `PROBE_RAW` is a positive raw amount reviewed against decimals, minimum transfers and manifest budget. Caller is `roles.liquidityOwner`; Registry-owner or registrar authority is unnecessary.

```bash
export PROBE_ASSET=base
export PROBE_RAW=REPLACE_WITH_REVIEWED_POSITIVE_RAW
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M)), asset=process.env.PROBE_ASSET;
if(!['base','quote'].includes(asset)||!/^[1-9][0-9]*$/.test(process.env.PROBE_RAW))throw Error('Review asset/positive probe raw amount');
fs.writeFileSync(`${process.env.D}/register-${asset}.request.json`,JSON.stringify({token:m[asset].address,amount:process.env.PROBE_RAW},null,2)+'\n',{flag:'wx'});
JS
plan register-approve "$D/register-base.request.json" "$D/register-base-approve.plan.json"
send "$D/register-base-approve.plan.json" REVIEWED_HASH
# After approval receipt, plan and review registration against current state
plan register "$D/register-base.request.json" "$D/register-base.plan.json"
send "$D/register-base.plan.json" REVIEWED_HASH
plan policy "$D/policy.request.json" "$D/policy.after-base.json"
```

If sufficient allowance yields `transactions:[]`, skip approval sending. If review identifies a required zero reset and allowance is positive, create a new `amount:"0"` request for the same token, run `plan register-approve` → review → send, then replan the positive amount. Reset requirements are not automatically detected. For unregistered quote, set `PROBE_ASSET=quote` and use `register-quote` filenames.

The registration executor checks nonce, gas, simulation and reviewHash and sends **one transaction at a time**. After success, it reconciles `StandardTokenRegistered`, wallet → Registry → wallet transfers, exact round-trip wallet/Registry balance changes of **zero** before/at the receipt block, and Standard policy, then prints `registrationVerified:true`. This is neither fee payment nor issuer certification. Confirm `poolSupported:true` before continuing.

Revoke remaining probe allowance through `register-approve` with `amount:"0"`; skip sending if already zero. Registration never replaces existing classifications/owner policy. `setPolicy` requires separate Registry-owner review; issuer registrar registration is not generally required. Direct pool trading and aggregation admission are separate. A probe verifies transfer behavior at that time, not reserves, redemption or future upgrade safety.

## 5. Discover or create a pool

Continue as the LP wallet. New exposure requires fresh independent price evidence and budget. The example uses `binStepBps:1`; review manifest caps and the **actual** pool fee. A 1 bp profile does not guarantee suitable prices or fees for every asset.

```bash
printf '{"binStepBps":1}\n' > "$D/discover.request.json"
plan discover "$D/discover.request.json" "$D/market.initial.json"
```

- `summary.route=existing-pool`: verify actual pair, fee and bins, then use this pool. **Do not send create.** Set `export MARKET="$D/market.initial.json"`.
- `summary.route=new-pool`: review the unsigned creation plan and send once. If another sender creates it first and your transaction fails, inspect the current pool key before proceeding.

```bash
# Run only for new-pool. REVIEWED_HASH is this plan's reviewed hash.
plan create "$D/discover.request.json" "$D/create.plan.json"
send "$D/create.plan.json" REVIEWED_HASH
# After a successful receipt, reread to verify the actually created pool
plan discover "$D/discover.request.json" "$D/market.after-create.json"
export MARKET="$D/market.after-create.json"
```

For either path, use the address only when `MARKET` has route `existing-pool`. A predicted address alone does not prove creation.

```bash
export POOL=$(node --input-type=module -e 'import fs from "node:fs";const p=JSON.parse(fs.readFileSync(process.env.MARKET));if(p.summary.route!=="existing-pool")throw Error("Pool not confirmed");console.log(p.summary.preflight.existingPool)')
```

## 6. Exact approvals → LP deposit

`BASE_RAW` and `QUOTE_RAW` are **actual deposit amounts**, separate from manifest caps. For example, `0.01` with 18 decimals is `10000000000000000 raw`; with 6 decimals it is `10000 raw`. Choose amounts for your reviewed budget, price and depth.

```bash
export BASE_RAW=REPLACE_WITH_REVIEWED_BASE_RAW
export QUOTE_RAW=REPLACE_WITH_REVIEWED_QUOTE_RAW
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M));
const f=JSON.parse(fs.readFileSync('extensions/almm-unified/giwa-profile.json'));
for(const [asset,amount,cap] of [['base',process.env.BASE_RAW,m.policy.maxBaseRaw],['quote',process.env.QUOTE_RAW,m.policy.maxQuoteRaw]]) {
  if(!/^[1-9][0-9]*$/.test(amount)||BigInt(amount)>BigInt(cap))throw Error('Review positive raw amount within budget');
  fs.writeFileSync(`${process.env.D}/approve-${asset}-manager.request.json`,JSON.stringify({pool:process.env.POOL,token:m[asset].address,spender:f.manager,amount},null,2)+'\n',{flag:'wx'});
}
JS
plan approve "$D/approve-base-manager.request.json" "$D/approve-base-manager.plan.json"
send "$D/approve-base-manager.plan.json" REVIEWED_HASH
plan approve "$D/approve-quote-manager.request.json" "$D/approve-quote-manager.plan.json"
send "$D/approve-quote-manager.plan.json" REVIEWED_HASH
```

Skip approvals with `transactions:[]`. If token review requires zero reset and current allowance is positive, use the zero-approval pattern in section 9 first, then replan positive approval under a new filename. Do not assume automatic reset detection.

The minimal example below deposits in one current bin. Reread the pool for activeId and use a fresh deadline. Range and one-sided strategies can follow the initial pilot.

```bash
plan discover "$D/discover.request.json" "$D/market.before-seed.json"
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M));
const market=JSON.parse(fs.readFileSync(process.env.D+'/market.before-seed.json'));
if(market.summary.route!=='existing-pool'||market.summary.preflight.existingPool.toLowerCase()!==process.env.POOL.toLowerCase())throw Error('Pool mismatch');
const active=market.summary.state.activeId;
const deadline=Math.floor(Date.now()/1000)+Math.min(300,m.policy.planTtlSeconds-30);
fs.writeFileSync(process.env.D+'/seed.request.json',JSON.stringify({pool:process.env.POOL,maximumBaseRaw:process.env.BASE_RAW,maximumQuoteRaw:process.env.QUOTE_RAW,lowerBinId:active,upperBinId:active,slippageBps:m.policy.maxSlippageBps,deadline:String(deadline)},null,2)+'\n',{flag:'wx'});
JS
plan seed "$D/seed.request.json" "$D/seed.plan.json"
send "$D/seed.plan.json" REVIEWED_HASH
```

Synchronize your computer clock and confirm deadline is after the plan's block timestamp and within TTL. Review a fresh request/plan if expired. Reconcile Manager `Transfer(0x0, LP, tokenId)` and `PositionCreated` in the successful seed receipt, then set `export POSITION_ID=...` to the **actually minted tokenId**. Never reuse another LP's ID. Manifest/output amounts are raw integers.

## 7. Trade and accrue fees

Review small base→quote and quote→base trades separately. **LP deposit approvals target the Manager; direct swap approvals target POOL.** The Controller needs no ERC20/NFT approvals.

```bash
export SWAP_SIDE=base
export SWAP_RAW=REPLACE_WITH_REVIEWED_INPUT_RAW
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M));
const side=process.env.SWAP_SIDE;
if(!['base','quote'].includes(side)||!/^[1-9][0-9]*$/.test(process.env.SWAP_RAW))throw Error('Review side/positive raw input');
const deadline=Math.floor(Date.now()/1000)+Math.min(300,m.policy.planTtlSeconds-30);
for(const [name,request] of [['approve-'+side+'-pool',{pool:process.env.POOL,token:m[side].address,spender:process.env.POOL,amount:process.env.SWAP_RAW}],['swap-'+side,{pool:process.env.POOL,includedAmountIn:process.env.SWAP_RAW,baseForQuote:side==='base',slippageBps:m.policy.maxSlippageBps,deadline:String(deadline)}]])fs.writeFileSync(`${process.env.D}/${name}.request.json`,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
JS
plan approve "$D/approve-base-pool.request.json" "$D/approve-base-pool.plan.json"
send "$D/approve-base-pool.plan.json" REVIEWED_HASH
plan swap "$D/swap-base.request.json" "$D/swap-base.plan.json"
send "$D/swap-base.plan.json" REVIEWED_HASH
```

For quote input, rerun the request-generation code with `SWAP_SIDE=quote` and a new input amount, using `approve-quote-pool` / `swap-quote` filenames. If approval takes time, refresh swap deadline in a new request file and replan. Reconcile actual pool `Swap`, ERC20 transfers, received balances and minimum output. Stop new swaps if depth, price deviation or cost limits fail.

## 8. feeOwner delegation and separate payouts

First inspect your actual tokenId, feeOwner and positive fee preview.

```bash
printf '{"pool":"%s","tokenId":"%s"}\n' "$POOL" "$POSITION_ID" > "$D/position.request.json"
plan inspect "$D/position.request.json" "$D/position.inspect.json"
```

Check `summary.position.owner`, `summary.position.feeOwner`, `canConfigure` and `feePreview`.

- **Direct claim:** set `AMMORA_ACCOUNT` to actual feeOwner, skip grant and proceed to claim. The feeOwner can also claim to separate `roles.payout`.
- **Delegated claim:** put a dedicated address different from feeOwner in manifest `roles.feeDelegate`, then let feeOwner set a fixed grant.

```bash
# Set AMMORA_ACCOUNT to the actual feeOwner before planning
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M));
if(!m.roles.feeDelegate||m.roles.feeDelegate.toLowerCase()===(m.roles.feeOwner??m.roles.liquidityOwner).toLowerCase())throw Error('Use a distinct delegate, or claim directly');
fs.writeFileSync(process.env.D+'/grant.request.json',JSON.stringify({pool:process.env.POOL,tokenId:process.env.POSITION_ID,delegate:m.roles.feeDelegate,recipientMode:'fixed',expiresAt:'0'},null,2)+'\n',{flag:'wx'});
JS
plan grant "$D/grant.request.json" "$D/grant.plan.json"
send "$D/grant.plan.json" REVIEWED_HASH
```

`expiresAt:"0"` deliberately means no expiry. To limit duration, specify a reviewed future UNIX timestamp in seconds. Individual/all-grant revocation, expiry and NFT transfer invalidate delegation. Fixed grants pay only the designated payout and convey no principal, NFT, reward or governance rights.

```bash
# Delegated claim: set AMMORA_ACCOUNT to roles.feeDelegate. Direct claim: keep feeOwner.
plan inspect "$D/position.request.json" "$D/claim.inspect.json"
plan claim "$D/position.request.json" "$D/claim.plan.json"
send "$D/claim.plan.json" REVIEWED_HASH
```

Confirm `readyForClaim:true`. The CLI verifies the exact RewardManager's `ALMMPositionFeeClaimed`, caller/NFT/pool/payout, ERC20 transfers and recipient balance increases before/at the receipt block. Check `payoutVerified:true` and actual amounts. `NO_POSITIVE_FEE_PAYOUT`, including from tiny swaps, is not successful payment.

**Separate feeOwner:** if `roles.feeOwner` differs from LP owner, seed uses the public bootstrap ABI. NFT recipient/operator is the LP and `lockReleasePoint=0`; no time lock is added. It enforces deadline/minimumShares but lacks the strategy API's atomic active-bin pin. Existing NFTs must match on-chain `positionFeeOwner`. NFT owners and issuer admins cannot redirect another feeOwner's fees; actual feeOwner grants/revokes authority.

## 9. Revoke, withdraw, close and clear allowances

Have feeOwner `revoke`, switch caller to that delegate, then `inspect` to confirm authority for the designated payout is gone. Actual feeOwner can also revoke historical delegates that differ from the current manifest. Existing owner/permissionless rights to fixed feeOwner payouts are separate.

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M));
fs.writeFileSync(process.env.D+'/revoke.request.json',JSON.stringify({pool:process.env.POOL,tokenId:process.env.POSITION_ID,delegate:m.roles.feeDelegate},null,2)+'\n',{flag:'wx'});
JS
# AMMORA_ACCOUNT = actual feeOwner. Run only if a grant was created.
plan revoke "$D/revoke.request.json" "$D/revoke.plan.json"
send "$D/revoke.plan.json" REVIEWED_HASH
```

LP owner withdraws principal. The `exit` request contains `pool`, `tokenId`, `slippageBps` within manifest `policy.maxSlippageBps`, and a fresh `deadline`. Run `plan exit REQUEST PLAN` → review → `send PLAN REVIEWED_HASH`, withdraw every bin's actual shares, and reconcile receipt by the LP owner. This example supports 1–64 bins.

```bash
# AMMORA_ACCOUNT = LP operating wallet
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M));
const deadline=Math.floor(Date.now()/1000)+Math.min(300,m.policy.planTtlSeconds-30);
fs.writeFileSync(process.env.D+'/exit.request.json',JSON.stringify({pool:process.env.POOL,tokenId:process.env.POSITION_ID,slippageBps:m.policy.maxSlippageBps,deadline:String(deadline)},null,2)+'\n',{flag:'wx'});
JS
plan exit "$D/exit.request.json" "$D/exit.plan.json"
send "$D/exit.plan.json" REVIEWED_HASH
```

After feeOwner or a valid delegate claims remaining positive fees, LP owner runs `plan close "$D/position.request.json" "$D/close.plan.json"` → review → send to close the empty NFT. With a separate feeOwner, finish its required fee claims before closing. Historical grants do not apply to new NFTs.

LP owner reviews and revokes remaining ERC20 allowances with `approve`, `amount:"0"`, for each Manager/POOL spender. Skip sends for already-zero `transactions:[]`. For example:

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync(process.env.M));
const f=JSON.parse(fs.readFileSync('extensions/almm-unified/giwa-profile.json'));
fs.writeFileSync(process.env.D+'/zero-base-manager.request.json',JSON.stringify({pool:process.env.POOL,token:m.base.address,spender:f.manager,amount:'0'},null,2)+'\n',{flag:'wx'});
JS
plan approve "$D/zero-base-manager.request.json" "$D/zero-base-manager.plan.json"
send "$D/zero-base-manager.plan.json" REVIEWED_HASH
```

Also inspect quote/Manager, base/POOL and quote/POOL. `approve(0)`, revocation and withdrawal are not blocked solely by stale prices, but current code, asset, issuer-control and authority checks still apply.

## 10. Authority rejections and real onboarding prerequisites

| State | Meaning / response |
| --- | --- |
| `Unauthorized()`, wrong fixed payout, revoked delegate | Expected protection; compare actual feeOwner, caller, grant and payout |
| Issuer admin/NFT owner cannot grant for a different feeOwner | No automatic fee authority; actual feeOwner must authorize |
| `poolAllowed=false`, unregistered asset, issuer pause/blacklist | Actual prerequisites that can block legitimate work; consult selected Registry and issuer |
| Changed runtime/proxy/authority | Review assets/deployments again; do not blindly update pins |
| Stale price, deviation or excessive quote cost | Review fresh evidence, budget and depth; do not disable checks |
| Pending nonce or existing hash/journal | Reconcile original transaction; no blind resend or forced nonce override |

## Validation scope

Read [current validation](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md) before using historical test targets.
