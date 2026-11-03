import { toolDescriptions } from "./tools.js";

type Schema = Record<string, unknown>;
const raw: Schema = { type: "string", pattern: "^(0|[1-9][0-9]{0,77})$" };
const addr: Schema = { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" };
const id: Schema = { type: "string", minLength: 1, maxLength: 128 };
const hash: Schema = { type: "string", pattern: "^0x[0-9a-f]{64}$" };
const obj = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({ type: "object", properties, required, additionalProperties: false });
const literal = (s: string): Schema => ({ type: "string", const: s });
const launch = { configId: raw, name: { type: "string", minLength: 1, maxLength: 128 }, symbol: { type: "string", minLength: 1, maxLength: 32 }, metadataURI: { type: "string", minLength: 1, maxLength: 512 } };
const trade = { action: literal("trade"), curve: addr, side: { enum: ["buy", "sell"] }, amountRaw: raw, slippageBps: { type: "integer", minimum: 0, maximum: 1000 }, graduationBoundary: { type: "boolean" }, payout: addr };
const recipients = obj({ schemaVersion: { const: 1 }, chainId: { const: 91342 }, registry: addr, templateId: raw, templateHash: hash, configOwner: addr, partnerRecipient: addr, liquidityPartner: addr, leftoverReceiver: addr });
const intent: Schema = { oneOf: [
  obj({ action: literal("config"), policy: recipients, saleSupplyRaw: raw, thresholdRaw: raw }),
  obj({ action: literal("launch"), ...launch }),
  obj({ action: literal("launch"), ...launch, firstBuyRaw: raw, minimumBaseRaw: raw }),
  obj({ action: literal("config-first-buy"), policy: recipients, saleSupplyRaw: raw, thresholdRaw: raw, name: launch.name, symbol: launch.symbol, metadataURI: launch.metadataURI, firstBuyRaw: raw, minimumBaseRaw: raw }),
  obj(trade, ["action", "curve", "side", "amountRaw", "slippageBps"]),
  obj({ action: literal("migrate"), curve: addr }),
  obj({ action: literal("claim-launch"), curve: addr, asset: { enum: ["base", "quote"] }, payout: addr }, ["action", "curve", "asset"]),
  obj({ action: literal("claim-lp"), curve: addr, tokenId: raw, payout: addr }, ["action", "curve", "tokenId"]),
] };
const schemas: Record<keyof typeof toolDescriptions, Schema> = {
  agent_get_context: obj({}), agent_get_config: obj({ configId: raw }), agent_get_launch: obj({ curve: addr }),
  agent_get_balances: obj({ tokens: { type: "array", items: addr, maxItems: 16 } }),
  agent_get_claimable: obj({ curve: addr }), agent_get_positions: obj({ curve: addr, tokenIds: { type: "array", items: raw, maxItems: 16 } }),
  agent_quote_trade: obj(trade, ["action", "curve", "side", "amountRaw", "slippageBps"]),
  agent_prepare: obj({ requestId: id, intent }),
  agent_prepare_approval: obj({ operationId: id, requestId: id, requirementIndex: { type: "integer", minimum: 0, maximum: 8 } }, ["operationId", "requestId"]),
  agent_refresh: obj({ operationId: id }), agent_submit: obj({ operationId: id, expectedDigest: hash }), agent_reconcile: obj({ operationId: id }),
};
/** Local metadata only. Runtime validators remain mandatory after model schema validation. */
export const toolDefinitions = Object.entries(toolDescriptions).map(([name, description]) => ({ name, description, inputSchema: schemas[name as keyof typeof schemas] }));
