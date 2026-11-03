# Read-only routes


```bash
AMMORA_CHAIN_ID=91342 npm run routing:quote -- concentrated 0xPOOL 0xINPUT 0xOUTPUT 1000000 0xRECIPIENT
AMMORA_CHAIN_ID=91342 npm run routing:auto-route-status
```


`routing:quote` uses an explicit candidate pool with the published GIWA auto-route core,
route catalog and matching factory profiles as one generation. Legacy permissionless pool
addresses are not substituted into this generation. Amounts are raw integers. The SDK checks provenance and
returns expiry, minimum output, approvals, venue observations and risk policy. No wallet
is created. Revalidate the route and obtain fresh quotes before executing in an application.

`routing:auto-route-status` separately verifies the opt-in GIWA auto-route generation's
runtime at one block. It does not change any other script's selected generation or register
a new curve. Individual registration/finality and runtime availability remain separate gates.

Runtime verification follows the manifest's 12-confirmation strategy. The quote client uses the
SDK's built-in batched, read-only, freshness-checked RPC transport. Original legacy-catalog and
RPC failures are retained in the follow-through evidence; a successful read does not authorize a swap.

## SDK 0.3.0 policy and venue status


```bash
npm run routing:policy -- 1036800 2 venue:demo
npm run venues:quote-math
```


These two commands are offline examples. The policy preview prints SDK defaults, a
partial duration override and the effective policy; it never updates a live client.
In your application pass the reviewed override to `AmmoraRouteClient.create` and read
`client.riskPolicy`. Use the actual deployment's block-time assumption.

Readiness uses `atomicMultiHop`. The status command reports generic venue observations
and disabled reasons, including their block/time; an observation does not refresh itself.
See [venue integration changes](https://docs.ammora.org/guides/src-venues-readme) and
[validation scope](https://github.com/AmmoraLabs/ammora-examples/blob/main/VALIDATION.md).
