# Lightweight external integration


```bash
AMMORA_CHAIN_ID=91342 npm run integration:quote -- concentrated 0xPOOL 0xINPUT 1000000 0xRECIPIENT
```


The `@ammora-protocol/sdk/integrate` entry point is useful for an existing aggregator.
It intentionally omits deployment attestation. This example first authenticates the explicit
pool's factory/implementation/clone via the full SDK, then quotes at one block and builds
pull-based calldata using a chain-time deadline. It prints the exact approval spender and
amount. There is no signer or send path. Use the returned spender and re-quote before sending.
