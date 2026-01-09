'use client';

import { useState } from 'react';

interface SDKMethod {
  name: string;
  signature: string;
  description: string;
  example?: string;
}

interface SDKCategory {
  title: string;
  icon: string;
  methods: SDKMethod[];
}

const SDK_DOCUMENTATION: SDKCategory[] = [
  {
    title: 'Context (ctx)',
    icon: '📋',
    methods: [
      {
        name: 'ctx.actionId',
        signature: 'string',
        description: 'Unique identifier for this action',
      },
      {
        name: 'ctx.executionId',
        signature: 'string',
        description: 'Unique identifier for this execution run',
      },
      {
        name: 'ctx.network',
        signature: "'mainnet' | 'testnet' | 'devnet'",
        description: 'Network this action is running on',
      },
      {
        name: 'ctx.triggerType',
        signature: "'event' | 'block' | 'schedule'",
        description: 'What triggered this execution',
      },
      {
        name: 'ctx.triggerData',
        signature: 'object',
        description: 'Data from the trigger (event payload, block info, etc.)',
        example: `// Event trigger
ctx.triggerData.eventType  // "0x1::coin::WithdrawEvent"
ctx.triggerData.eventData  // Event payload
ctx.triggerData.transactionHash

// Block trigger
ctx.triggerData.blockHeight
ctx.triggerData.timestamp

// Schedule trigger
ctx.triggerData.scheduledTime
ctx.triggerData.cronExpression`,
      },
      {
        name: 'ctx.secrets',
        signature: 'Record<string, string>',
        description: 'Encrypted secrets configured for this action',
        example: `const apiKey = ctx.secrets.MY_API_KEY;
const webhook = ctx.secrets.DISCORD_WEBHOOK_URL;`,
      },
    ],
  },
  {
    title: 'Movement SDK (ctx.movement)',
    icon: '⛓️',
    methods: [
      {
        name: 'movement.getResource',
        signature: '(address: string, resourceType: string) => Promise<object>',
        description: 'Get a specific resource from an account',
        example: `const coinStore = await ctx.movement.getResource(
  "0x1",
  "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
);`,
      },
      {
        name: 'movement.getResources',
        signature: '(address: string) => Promise<object[]>',
        description: 'Get all resources from an account',
      },
      {
        name: 'movement.view',
        signature: '(payload: { function: string, typeArguments?: string[], arguments?: any[] }) => Promise<any[]>',
        description: 'Call a Move view function (read-only)',
        example: `const result = await ctx.movement.view({
  function: "0x1::coin::balance",
  typeArguments: ["0x1::aptos_coin::AptosCoin"],
  arguments: ["0x123..."]
});`,
      },
      {
        name: 'movement.submitTransaction',
        signature: '(payload: { function: string, typeArguments?: string[], arguments?: any[], maxGasAmount?: number }) => Promise<TxResult>',
        description: 'Sign and submit a transaction (requires PRIVATE_KEY secret)',
        example: `const result = await ctx.movement.submitTransaction({
  function: "0x1::coin::transfer",
  typeArguments: ["0x1::aptos_coin::AptosCoin"],
  arguments: ["0xrecipient", "1000000"],
  maxGasAmount: 50000
});
// Returns: { hash, success, vmStatus, gasUsed, sender }`,
      },
      {
        name: 'movement.getBalance',
        signature: '(address: string, coinType?: string) => Promise<{ balance: string, coinType: string }>',
        description: 'Get coin balance for an address (defaults to MOVE)',
        example: `const move = await ctx.movement.getBalance("0x123...");
const usdc = await ctx.movement.getBalance(
  "0x123...",
  ctx.helpers.coins.USDC
);`,
      },
      {
        name: 'movement.getAccountInfo',
        signature: '(address: string) => Promise<{ exists: boolean, sequenceNumber: string }>',
        description: 'Check if account exists and get sequence number',
      },
      {
        name: 'movement.getLedgerInfo',
        signature: '() => Promise<{ chainId, epoch, blockHeight, ledgerVersion, ledgerTimestamp }>',
        description: 'Get current chain state information',
      },
      {
        name: 'movement.getBlockHeight',
        signature: '() => Promise<number>',
        description: 'Get current block height',
      },
      {
        name: 'movement.getEvents',
        signature: '(address: string, eventHandle: string, fieldName: string, limit?: number) => Promise<Event[]>',
        description: 'Query events by event handle',
      },
      {
        name: 'movement.getTableItem',
        signature: '(tableHandle: string, keyType: string, valueType: string, key: any) => Promise<any>',
        description: 'Read from Move table (useful for AMM pools)',
      },
    ],
  },
  {
    title: 'Storage (ctx.kv)',
    icon: '💾',
    methods: [
      {
        name: 'kv.set',
        signature: '(key: string, value: any) => Promise<boolean>',
        description: 'Store a value (auto-serializes objects, 30-day TTL)',
        example: `await ctx.kv.set('last_price', 1.5);
await ctx.kv.set('state', { count: 1, updated: Date.now() });`,
      },
      {
        name: 'kv.get',
        signature: '(key: string) => Promise<any>',
        description: 'Retrieve a stored value (auto-deserializes)',
        example: `const lastPrice = await ctx.kv.get('last_price');
const state = await ctx.kv.get('state'); // { count: 1, ... }`,
      },
      {
        name: 'kv.delete',
        signature: '(key: string) => Promise<boolean>',
        description: 'Remove a stored value',
      },
      {
        name: 'kv.list',
        signature: '() => Promise<string[]>',
        description: 'List all keys for this action',
      },
    ],
  },
  {
    title: 'Helpers (ctx.helpers)',
    icon: '🛠️',
    methods: [
      {
        name: 'helpers.coins',
        signature: 'object',
        description: 'Common token addresses on Movement',
        example: `helpers.coins.MOVE   // 0x1::aptos_coin::AptosCoin
helpers.coins.USDC   // LayerZero bridged USDC
helpers.coins.USDT   // LayerZero bridged USDT
helpers.coins.WETH   // LayerZero bridged WETH
helpers.coins.WBTC   // LayerZero bridged WBTC`,
      },
      {
        name: 'helpers.protocols',
        signature: 'object',
        description: 'Common protocol addresses',
        example: `helpers.protocols.ECHELON         // Echelon lending
helpers.protocols.LAYERZERO_BRIDGE // LayerZero OFT bridge`,
      },
      {
        name: 'helpers.decimals',
        signature: 'object',
        description: 'Token decimal places',
        example: `helpers.decimals.MOVE  // 8
helpers.decimals.USDC  // 6
helpers.decimals.USDT  // 6`,
      },
      {
        name: 'helpers.formatAmount',
        signature: '(amount: string, decimals?: number) => string',
        description: 'Convert raw units to human-readable',
        example: `helpers.formatAmount("100000000", 8) // "1"
helpers.formatAmount("1500000", 6)   // "1.5"`,
      },
      {
        name: 'helpers.parseAmount',
        signature: '(amount: string, decimals?: number) => string',
        description: 'Convert human-readable to raw units',
        example: `helpers.parseAmount("1.5", 8)  // "150000000"
helpers.parseAmount("100", 6)  // "100000000"`,
      },
      {
        name: 'helpers.truncateAddress',
        signature: '(address: string, start?: number, end?: number) => string',
        description: 'Shorten address for display',
        example: `helpers.truncateAddress("0x1234567890abcdef")
// "0x1234...cdef"`,
      },
      {
        name: 'helpers.dex.getAmountOut',
        signature: '(amountIn, reserveIn, reserveOut, feeBps?) => string',
        description: 'Calculate AMM swap output (constant product)',
      },
      {
        name: 'helpers.dex.getPriceImpact',
        signature: '(amountIn, reserveIn, reserveOut) => string',
        description: 'Calculate price impact percentage',
      },
      {
        name: 'helpers.time.now',
        signature: '() => number',
        description: 'Current timestamp in milliseconds',
      },
      {
        name: 'helpers.time.secondsAgo',
        signature: '(seconds: number) => number',
        description: 'Timestamp from N seconds ago',
      },
    ],
  },
  {
    title: 'Network (fetch)',
    icon: '🌐',
    methods: [
      {
        name: 'fetch',
        signature: '(url: string, options?: RequestInit) => Promise<Response>',
        description: 'Make HTTPS requests (HTTP blocked, localhost blocked)',
        example: `// Send Discord webhook
await fetch(ctx.secrets.DISCORD_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    embeds: [{
      title: 'Alert!',
      description: 'Something happened',
      color: 0xff0000
    }]
  })
});

// Send Telegram message
await fetch(\`https://api.telegram.org/bot\${ctx.secrets.BOT_TOKEN}/sendMessage\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: ctx.secrets.CHAT_ID,
    text: 'Alert message',
    parse_mode: 'Markdown'
  })
});`,
      },
    ],
  },
];

const CODE_TEMPLATE = `/**
 * Action Handler
 *
 * Export a default async function that receives the context.
 */
export default async function handler(ctx) {
  const { movement, kv, secrets, triggerData, helpers } = ctx;

  // Your logic here
  console.log('Action triggered:', triggerData);

  // Return a result (optional)
  return { success: true };
}`;

export function SDKDocPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null);

  const copyToClipboard = (text: string, methodName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMethod(methodName);
    setTimeout(() => setCopiedMethod(null), 2000);
  };

  return (
    <div className="mt-4 border border-dark-600 rounded-lg overflow-hidden">
      {/* Toggle Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-dark-750 hover:bg-dark-700 flex items-center justify-between
                   text-sm font-medium text-dark-300 hover:text-dark-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>📚 SDK Documentation</span>
        </span>
        <span className="text-xs text-dark-500">
          {isOpen ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      {/* Documentation Content */}
      {isOpen && (
        <div className="border-t border-dark-600">
          {/* Quick Start Template */}
          <div className="p-4 bg-dark-800/50 border-b border-dark-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-dark-400">Quick Start Template</span>
              <button
                type="button"
                onClick={() => copyToClipboard(CODE_TEMPLATE, 'template')}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                {copiedMethod === 'template' ? '✓ Copied!' : 'Copy template'}
              </button>
            </div>
            <pre className="text-xs text-dark-300 bg-dark-900 p-3 rounded overflow-x-auto">
              {CODE_TEMPLATE}
            </pre>
          </div>

          {/* Categories */}
          <div className="p-4 space-y-2">
            {SDK_DOCUMENTATION.map((category) => (
              <div key={category.title} className="border border-dark-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setActiveCategory(activeCategory === category.title ? null : category.title)
                  }
                  className="w-full px-3 py-2 bg-dark-800 hover:bg-dark-750 flex items-center
                             justify-between text-sm transition-colors"
                >
                  <span className="flex items-center gap-2 text-dark-200">
                    <span>{category.icon}</span>
                    <span>{category.title}</span>
                    <span className="text-xs text-dark-500">({category.methods.length})</span>
                  </span>
                  <svg
                    className={`w-4 h-4 text-dark-500 transition-transform ${
                      activeCategory === category.title ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {activeCategory === category.title && (
                  <div className="bg-dark-850 border-t border-dark-700">
                    {category.methods.map((method, idx) => (
                      <div
                        key={method.name}
                        className={`p-3 ${idx > 0 ? 'border-t border-dark-700' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <code className="text-xs text-primary-400 font-mono break-all">
                              {method.name}
                            </code>
                            <p className="text-xs text-dark-500 font-mono mt-0.5 break-all">
                              {method.signature}
                            </p>
                            <p className="text-xs text-dark-400 mt-1">{method.description}</p>
                          </div>
                          {method.example && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(method.example!, method.name)}
                              className="flex-shrink-0 text-xs text-dark-500 hover:text-dark-300
                                         px-2 py-1 rounded hover:bg-dark-700"
                            >
                              {copiedMethod === method.name ? '✓' : 'Copy'}
                            </button>
                          )}
                        </div>
                        {method.example && (
                          <pre className="mt-2 text-xs text-dark-300 bg-dark-900 p-2 rounded
                                          overflow-x-auto whitespace-pre-wrap">
                            {method.example}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contract Addresses Reference */}
          <div className="p-4 bg-dark-800/50 border-t border-dark-600">
            <h4 className="text-xs font-medium text-dark-300 mb-2">
              Movement Contract Addresses (Mainnet)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-dark-900 p-2 rounded">
                <span className="text-dark-500">MOVE (Coin):</span>
                <code className="text-dark-300 ml-1 break-all">0x1::aptos_coin::AptosCoin</code>
              </div>
              <div className="bg-dark-900 p-2 rounded">
                <span className="text-dark-500">USDC:</span>
                <code className="text-dark-300 ml-1 break-all">helpers.coins.USDC</code>
              </div>
              <div className="bg-dark-900 p-2 rounded">
                <span className="text-dark-500">USDT:</span>
                <code className="text-dark-300 ml-1 break-all">helpers.coins.USDT</code>
              </div>
              <div className="bg-dark-900 p-2 rounded">
                <span className="text-dark-500">Echelon:</span>
                <code className="text-dark-300 ml-1 break-all">helpers.protocols.ECHELON</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
