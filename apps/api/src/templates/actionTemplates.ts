/**
 * Movement-Specific Action Templates
 *
 * Pre-built templates for common Movement Network use cases.
 * These templates provide working starting points for developers.
 *
 * CONTRACT ADDRESS REFERENCE (Movement Mainnet):
 * ─────────────────────────────────────────────────────────────────
 * Native Tokens:
 *   MOVE (Gas Token FA): 0x42afc6935b692cd286e3087a4464ec516a60dd21c9e355e1b8b0088376501372
 *   MOVE (Coin Type):    0x1::aptos_coin::AptosCoin
 *
 * LayerZero Bridged Assets (via Movement Bridge):
 *   USDC: 0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC
 *   USDT: 0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT
 *   WETH: 0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH
 *   WBTC: 0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC
 *
 * Echelon Lending Protocol:
 *   Module: 0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba
 *   Docs:   https://docs.echelon.market
 *
 * Standard Move Modules:
 *   Coin:       0x1::coin
 *   FA:         0x1::fungible_asset
 *   NFT:        0x4::collection
 *   Governance: 0x1::aptos_governance
 * ─────────────────────────────────────────────────────────────────
 */

import type { ActionTriggerType } from '@movewatch/shared';

// ============================================================================
// MOVEMENT CONTRACT ADDRESSES
// ============================================================================

/** LayerZero Bridge module address for bridged assets */
export const LAYERZERO_BRIDGE = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa';

/** Echelon lending protocol module address */
export const ECHELON_MODULE = '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba';

/** Common token types on Movement */
export const TOKENS = {
  MOVE: '0x1::aptos_coin::AptosCoin',
  MOVE_FA: '0x42afc6935b692cd286e3087a4464ec516a60dd21c9e355e1b8b0088376501372',
  USDC: `${LAYERZERO_BRIDGE}::asset::USDC`,
  USDT: `${LAYERZERO_BRIDGE}::asset::USDT`,
  WETH: `${LAYERZERO_BRIDGE}::asset::WETH`,
  WBTC: `${LAYERZERO_BRIDGE}::asset::WBTC`,
} as const;

export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  category: 'defi' | 'security' | 'monitoring' | 'nft' | 'utility';
  triggerType: ActionTriggerType;
  triggerConfig: Record<string, unknown>;
  code: string;
  requiredSecrets: Array<{
    name: string;
    description: string;
  }>;
  network: 'mainnet' | 'testnet' | 'both';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// ============================================================================
// DEX ARBITRAGE TEMPLATE
// ============================================================================

const dexArbitrageTemplate: ActionTemplate = {
  id: 'dex-arbitrage',
  name: 'DEX Arbitrage Monitor',
  description:
    'Monitor price differences across Movement DEXes (Meridian, Pontem) and alert when profitable arbitrage opportunities exist.',
  category: 'defi',
  triggerType: 'block',
  triggerConfig: {
    type: 'block',
    interval: 5, // Every 5 blocks
  },
  requiredSecrets: [
    {
      name: 'DISCORD_WEBHOOK_URL',
      description: 'Discord webhook to receive arbitrage alerts',
    },
  ],
  network: 'mainnet',
  difficulty: 'intermediate',
  code: `/**
 * DEX Arbitrage Monitor for Movement Network
 *
 * Compares prices across major Movement DEXes to find arbitrage opportunities.
 * Trigger: Every 5 blocks
 *
 * SETUP: Configure DEX addresses below for the AMMs you want to monitor.
 * Movement DEX ecosystem is growing - check docs.movementnetwork.xyz for current DEXes.
 */

async function main(ctx) {
  const { network, kv, secrets, movement } = ctx;

  // ============================================================================
  // CONFIGURATION - Using real Movement token addresses
  // ============================================================================

  // LayerZero bridged assets on Movement
  const LAYERZERO = '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa';

  // Token pairs to monitor (using real Movement addresses)
  const PAIRS = [
    {
      base: '0x1::aptos_coin::AptosCoin',
      quote: \`\${LAYERZERO}::asset::USDC\`,
      symbol: 'MOVE/USDC',
      decimalsBase: 8,
      decimalsQuote: 6,
    },
    {
      base: '0x1::aptos_coin::AptosCoin',
      quote: \`\${LAYERZERO}::asset::USDT\`,
      symbol: 'MOVE/USDT',
      decimalsBase: 8,
      decimalsQuote: 6,
    },
  ];

  // Minimum profit threshold (0.5%)
  const MIN_PROFIT_PERCENT = 0.5;

  // DEX configurations - Update these with actual Movement DEX module addresses
  // Check https://defillama.com/chain/Movement for current DEXes
  const DEXES = {
    // Example DEX configurations (update with real addresses when available)
    dex1: {
      name: 'DEX 1',
      // Pool resource type to query reserves
      poolType: 'YOUR_DEX_ADDRESS::amm::Pool',
      // View function to get price
      getPriceFn: 'YOUR_DEX_ADDRESS::amm::get_price',
    },
    dex2: {
      name: 'DEX 2',
      poolType: 'YOUR_DEX_ADDRESS_2::swap::Pool',
      getPriceFn: 'YOUR_DEX_ADDRESS_2::swap::get_amount_out',
    },
  };

  const opportunities = [];

  for (const pair of PAIRS) {
    console.log(\`Checking \${pair.symbol}...\`);

    // In production, fetch actual prices from DEX view functions
    // This is a simplified example showing the pattern
    const prices = {};

    for (const [dexId, dex] of Object.entries(DEXES)) {
      try {
        // Simulate fetching price from DEX
        // In production: ctx.movement.view(\`\${dex.poolModule}::get_price\`, [...])
        const mockPrice = 1 + Math.random() * 0.02; // Mock variation
        prices[dexId] = {
          price: mockPrice,
          dexName: dex.name,
        };
      } catch (error) {
        console.log(\`Failed to fetch from \${dex.name}: \${error.message}\`);
      }
    }

    // Find best buy and sell prices
    const priceList = Object.entries(prices);
    if (priceList.length < 2) continue;

    let minPrice = { dex: '', price: Infinity };
    let maxPrice = { dex: '', price: 0 };

    for (const [dexId, data] of priceList) {
      if (data.price < minPrice.price) {
        minPrice = { dex: data.dexName, price: data.price };
      }
      if (data.price > maxPrice.price) {
        maxPrice = { dex: data.dexName, price: data.price };
      }
    }

    // Calculate potential profit
    const profitPercent = ((maxPrice.price - minPrice.price) / minPrice.price) * 100;

    if (profitPercent >= MIN_PROFIT_PERCENT) {
      opportunities.push({
        pair: pair.symbol,
        buyDex: minPrice.dex,
        buyPrice: minPrice.price,
        sellDex: maxPrice.dex,
        sellPrice: maxPrice.price,
        profitPercent: profitPercent.toFixed(2),
      });
    }
  }

  if (opportunities.length > 0) {
    console.log(\`Found \${opportunities.length} arbitrage opportunity(ies)\`);

    // Send Discord notification if webhook configured
    if (secrets.DISCORD_WEBHOOK_URL) {
      const message = {
        embeds: [{
          title: '🔄 Arbitrage Opportunity Detected',
          color: 0x22c55e,
          fields: opportunities.map(opp => ({
            name: opp.pair,
            value: \`Buy on \${opp.buyDex} @ \${opp.buyPrice.toFixed(6)}\\nSell on \${opp.sellDex} @ \${opp.sellPrice.toFixed(6)}\\n**Profit: \${opp.profitPercent}%**\`,
            inline: true,
          })),
          timestamp: new Date().toISOString(),
        }],
      };

      await fetch(secrets.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    }

    // Store for tracking
    await kv.set('last_opportunities', JSON.stringify(opportunities));

    return { found: true, opportunities };
  }

  console.log('No arbitrage opportunities found');
  return { found: false };
}
`,
};

// ============================================================================
// LIQUIDATION BOT TEMPLATE
// ============================================================================

const liquidationBotTemplate: ActionTemplate = {
  id: 'liquidation-bot',
  name: 'Liquidation Monitor',
  description:
    'Monitor lending protocol positions and alert when accounts become liquidatable. Can be extended to execute liquidations.',
  category: 'defi',
  triggerType: 'block',
  triggerConfig: {
    type: 'block',
    interval: 3, // Every 3 blocks for faster detection
  },
  requiredSecrets: [
    {
      name: 'TELEGRAM_BOT_TOKEN',
      description: 'Telegram bot token for alerts',
    },
    {
      name: 'TELEGRAM_CHAT_ID',
      description: 'Telegram chat ID to send alerts to',
    },
  ],
  network: 'mainnet',
  difficulty: 'advanced',
  code: `/**
 * Liquidation Monitor for Movement Lending Protocols
 *
 * Monitors positions on lending protocols like Echelon and alerts
 * when health factors drop below threshold.
 *
 * Trigger: Every 3 blocks
 *
 * ECHELON DOCS: https://docs.echelon.market
 * SDK: https://github.com/EchelonMarket/echelon-sdk
 */

async function main(ctx) {
  const { network, kv, secrets, movement } = ctx;

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const HEALTH_FACTOR_THRESHOLD = 1.1; // Alert when HF < 1.1
  const LIQUIDATION_THRESHOLD = 1.0;   // Position can be liquidated when HF < 1.0

  // Echelon Lending Protocol - Real Module Address
  // Docs: https://docs.echelon.market
  const ECHELON_MODULE = '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba';

  // Lending protocol configurations
  const LENDING_PROTOCOLS = [
    {
      name: 'Echelon',
      module: ECHELON_MODULE,
      // Use Echelon SDK methods - check their docs for exact function names
      getPositionsFn: 'lending::get_user_positions',
      getHealthFactorFn: 'lending::get_health_factor',
    },
  ];

  // Get tracked positions from KV store (or fetch all)
  const trackedPositions = await kv.get('tracked_positions');
  const positions = trackedPositions ? JSON.parse(trackedPositions) : [];

  const atRiskPositions = [];
  const liquidatablePositions = [];

  for (const protocol of LENDING_PROTOCOLS) {
    console.log(\`Checking \${protocol.name}...\`);

    // In production, fetch actual positions from the protocol
    // const positions = await ctx.movement.view(
    //   \`\${protocol.module}::\${protocol.getPositionsFn}\`,
    //   []
    // );

    // Mock positions for demonstration
    const mockPositions = [
      { address: '0x1234...abcd', collateral: 1000, debt: 800, healthFactor: 1.08 },
      { address: '0x5678...efgh', collateral: 500, debt: 480, healthFactor: 0.95 },
    ];

    for (const position of mockPositions) {
      if (position.healthFactor < LIQUIDATION_THRESHOLD) {
        liquidatablePositions.push({
          protocol: protocol.name,
          address: position.address,
          healthFactor: position.healthFactor,
          collateral: position.collateral,
          debt: position.debt,
          profit: (position.collateral * 0.05).toFixed(2), // 5% liquidation bonus
        });
      } else if (position.healthFactor < HEALTH_FACTOR_THRESHOLD) {
        atRiskPositions.push({
          protocol: protocol.name,
          address: position.address,
          healthFactor: position.healthFactor,
        });
      }
    }
  }

  // Send alerts
  if (liquidatablePositions.length > 0 && secrets.TELEGRAM_BOT_TOKEN && secrets.TELEGRAM_CHAT_ID) {
    const message = \`🚨 *LIQUIDATABLE POSITIONS DETECTED*\\n\\n\` +
      liquidatablePositions.map(p =>
        \`Protocol: \${p.protocol}\\nAddress: \\\`\${p.address}\\\`\\nHealth Factor: \${p.healthFactor}\\nEst. Profit: \$\${p.profit}\\n\`
      ).join('\\n---\\n');

    await fetch(\`https://api.telegram.org/bot\${secrets.TELEGRAM_BOT_TOKEN}/sendMessage\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: secrets.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    console.log(\`Sent alert for \${liquidatablePositions.length} liquidatable position(s)\`);
  }

  if (atRiskPositions.length > 0) {
    console.log(\`\${atRiskPositions.length} position(s) at risk (HF < \${HEALTH_FACTOR_THRESHOLD})\`);
  }

  // Store state
  await kv.set('last_check', JSON.stringify({
    timestamp: new Date().toISOString(),
    atRisk: atRiskPositions.length,
    liquidatable: liquidatablePositions.length,
  }));

  return {
    atRiskCount: atRiskPositions.length,
    liquidatableCount: liquidatablePositions.length,
    liquidatablePositions,
  };
}
`,
};

// ============================================================================
// TREASURY MONITORING TEMPLATE
// ============================================================================

const treasuryMonitorTemplate: ActionTemplate = {
  id: 'treasury-monitor',
  name: 'Treasury Balance Monitor',
  description:
    'Monitor protocol treasury or DAO wallet balances. Alert when balances change significantly or drop below thresholds.',
  category: 'monitoring',
  triggerType: 'schedule',
  triggerConfig: {
    type: 'schedule',
    cron: '0 * * * *', // Every hour
    timezone: 'UTC',
  },
  requiredSecrets: [
    {
      name: 'SLACK_WEBHOOK_URL',
      description: 'Slack webhook for treasury alerts',
    },
  ],
  network: 'both',
  difficulty: 'beginner',
  code: `/**
 * Treasury Balance Monitor
 *
 * Monitors treasury wallet balances and alerts on significant changes.
 * Trigger: Hourly
 *
 * SETUP: Replace the example addresses below with your actual treasury addresses.
 * You can find wallet addresses on the Movement Explorer: https://explorer.movementnetwork.xyz
 */

async function main(ctx) {
  const { network, kv, secrets, movement } = ctx;

  // ============================================================================
  // CONFIGURATION - Update with your treasury addresses
  // ============================================================================

  // Example treasury addresses - REPLACE THESE with your actual addresses
  // Format: 0x followed by 64 hex characters
  const TREASURIES = [
    {
      name: 'Protocol Treasury',
      // TODO: Replace with your treasury address
      address: '0x0000000000000000000000000000000000000000000000000000000000000001',
      minBalance: 100000, // Alert if below 100k MOVE (in human-readable units)
      coinType: '0x1::aptos_coin::AptosCoin', // MOVE token
      decimals: 8,
    },
    {
      name: 'USDC Reserve',
      // TODO: Replace with your USDC reserve address
      address: '0x0000000000000000000000000000000000000000000000000000000000000002',
      minBalance: 50000, // 50k USDC
      // LayerZero bridged USDC on Movement
      coinType: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
      decimals: 6,
    },
  ];

  // Threshold for significant change (5%)
  const CHANGE_THRESHOLD_PERCENT = 5;

  const results = [];
  const alerts = [];

  for (const treasury of TREASURIES) {
    console.log(\`Checking \${treasury.name}...\`);

    // In production, fetch actual balance
    // const balance = await ctx.movement.getAccountBalance(treasury.address);

    // Mock balance for demonstration
    const balance = 75000 + Math.random() * 50000;

    // Get previous balance from KV
    const prevBalanceStr = await kv.get(\`treasury_\${treasury.address}\`);
    const prevBalance = prevBalanceStr ? parseFloat(prevBalanceStr) : balance;

    // Calculate change
    const change = balance - prevBalance;
    const changePercent = prevBalance > 0 ? (change / prevBalance) * 100 : 0;

    const treasuryResult = {
      name: treasury.name,
      address: treasury.address,
      balance: balance.toFixed(2),
      previousBalance: prevBalance.toFixed(2),
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(2),
    };

    results.push(treasuryResult);

    // Check for alerts
    if (balance < treasury.minBalance) {
      alerts.push({
        type: 'LOW_BALANCE',
        severity: 'critical',
        treasury: treasury.name,
        message: \`Balance (\${balance.toFixed(2)} MOVE) below minimum (\${treasury.minBalance} MOVE)\`,
      });
    }

    if (Math.abs(changePercent) >= CHANGE_THRESHOLD_PERCENT) {
      alerts.push({
        type: 'SIGNIFICANT_CHANGE',
        severity: changePercent < 0 ? 'warning' : 'info',
        treasury: treasury.name,
        message: \`Balance changed by \${changePercent > 0 ? '+' : ''}\${changePercent.toFixed(2)}% (\${change > 0 ? '+' : ''}\${change.toFixed(2)} MOVE)\`,
      });
    }

    // Store new balance
    await kv.set(\`treasury_\${treasury.address}\`, balance.toString());
  }

  // Send Slack alert if there are any alerts
  if (alerts.length > 0 && secrets.SLACK_WEBHOOK_URL) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💰 Treasury Alert',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alerts.map(a =>
            \`*[\${a.severity.toUpperCase()}]* \${a.treasury}\\n\${a.message}\`
          ).join('\\n\\n'),
        },
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: \`Network: \${network} | \${new Date().toISOString()}\`,
        }],
      },
    ];

    await fetch(secrets.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    console.log(\`Sent \${alerts.length} alert(s) to Slack\`);
  }

  // Store summary
  await kv.set('last_check', JSON.stringify({
    timestamp: new Date().toISOString(),
    treasuryCount: results.length,
    alertCount: alerts.length,
  }));

  return { treasuries: results, alerts };
}
`,
};

// ============================================================================
// NFT MINT DETECTOR TEMPLATE
// ============================================================================

const nftMintDetectorTemplate: ActionTemplate = {
  id: 'nft-mint-detector',
  name: 'NFT Mint Detector',
  description:
    'Monitor NFT collections for new mints. Get notified instantly when tokens are minted from watched collections.',
  category: 'nft',
  triggerType: 'event',
  triggerConfig: {
    type: 'event',
    eventType: '0x4::collection::MintEvent', // Standard Aptos NFT mint event
    moduleAddress: '0x4',
  },
  requiredSecrets: [
    {
      name: 'DISCORD_WEBHOOK_URL',
      description: 'Discord webhook for mint notifications',
    },
  ],
  network: 'mainnet',
  difficulty: 'beginner',
  code: `/**
 * NFT Mint Detector
 *
 * Monitors NFT mint events and sends notifications for watched collections.
 * Trigger: On MintEvent emission
 *
 * SETUP: Add your NFT collection addresses below.
 * Find collections on Movement NFT marketplaces or the explorer.
 *
 * Movement uses Aptos NFT standards (0x4::collection module)
 */

async function main(ctx) {
  const { trigger, kv, secrets, network } = ctx;

  // ============================================================================
  // CONFIGURATION - Add your NFT collection addresses
  // ============================================================================

  // Collections to watch - Update with real collection addresses
  // Format: Creator address that deployed the collection
  const WATCHED_COLLECTIONS = [
    {
      // TODO: Replace with actual collection creator address
      address: '0x0000000000000000000000000000000000000000000000000000000000000001',
      name: 'My NFT Collection',
      // Optional: only alert for mints above this MOVE price
      minPrice: 0,
    },
    // Add more collections as needed:
    // {
    //   address: '0x...',
    //   name: 'Another Collection',
    //   minPrice: 100,
    // },
  ];

  // Extract event data from trigger
  const eventData = trigger.eventData;
  const collection = eventData?.collection;
  const tokenId = eventData?.token_id;
  const minter = eventData?.minter;

  if (!collection) {
    console.log('No collection in event data, skipping');
    return { skipped: true, reason: 'no_collection' };
  }

  // Check if this is a watched collection
  const watchedCollection = WATCHED_COLLECTIONS.find(
    c => c.address.toLowerCase() === collection.toLowerCase()
  );

  if (!watchedCollection) {
    console.log(\`Collection \${collection} not in watch list, skipping\`);
    return { skipped: true, reason: 'not_watched' };
  }

  console.log(\`Detected mint in \${watchedCollection.name}!\`);

  // Track mint statistics
  const statsKey = \`mint_stats_\${collection}\`;
  const statsStr = await kv.get(statsKey);
  const stats = statsStr ? JSON.parse(statsStr) : { totalMints: 0, uniqueMinters: [] };

  stats.totalMints++;
  if (minter && !stats.uniqueMinters.includes(minter)) {
    stats.uniqueMinters.push(minter);
  }

  await kv.set(statsKey, JSON.stringify(stats));

  // Send Discord notification
  if (secrets.DISCORD_WEBHOOK_URL) {
    const embed = {
      title: \`🎨 New NFT Minted!\`,
      color: 0x7c3aed, // Purple
      fields: [
        {
          name: 'Collection',
          value: watchedCollection.name,
          inline: true,
        },
        {
          name: 'Token ID',
          value: tokenId ? \`#\${tokenId}\` : 'Unknown',
          inline: true,
        },
        {
          name: 'Minter',
          value: minter ? \`\\\`\${minter.slice(0, 8)}...\${minter.slice(-6)}\\\`\` : 'Unknown',
          inline: true,
        },
        {
          name: 'Collection Stats',
          value: \`Total Mints: \${stats.totalMints}\\nUnique Minters: \${stats.uniqueMinters.length}\`,
          inline: false,
        },
      ],
      footer: {
        text: 'MoveWatch NFT Monitor',
      },
      timestamp: new Date().toISOString(),
    };

    await fetch(secrets.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    console.log('Sent Discord notification');
  }

  return {
    detected: true,
    collection: watchedCollection.name,
    tokenId,
    minter,
    totalMints: stats.totalMints,
  };
}
`,
};

// ============================================================================
// WHALE WATCHER TEMPLATE
// ============================================================================

const whaleWatcherTemplate: ActionTemplate = {
  id: 'whale-watcher',
  name: 'Whale Transaction Watcher',
  description:
    'Monitor large token transfers (whale movements) and get instant notifications when significant amounts move.',
  category: 'monitoring',
  triggerType: 'event',
  triggerConfig: {
    type: 'event',
    eventType: '0x1::coin::WithdrawEvent',
    filters: {
      amount: { operator: 'gte', value: 1000000000000 }, // 10,000+ MOVE (8 decimals)
    },
  },
  requiredSecrets: [
    {
      name: 'TELEGRAM_BOT_TOKEN',
      description: 'Telegram bot token for whale alerts',
    },
    {
      name: 'TELEGRAM_CHAT_ID',
      description: 'Telegram chat or channel ID',
    },
  ],
  network: 'mainnet',
  difficulty: 'beginner',
  code: `/**
 * Whale Transaction Watcher
 *
 * Monitors for large token transfers and sends real-time alerts.
 * Trigger: On large WithdrawEvent (10,000+ MOVE)
 *
 * This template monitors the native MOVE token (0x1::aptos_coin::AptosCoin).
 * MOVE uses 8 decimals (same as APT on Aptos).
 */

async function main(ctx) {
  const { trigger, kv, secrets, network, movement } = ctx;

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  // MOVE token configuration
  const MOVE_DECIMALS = 8;                    // MOVE uses 8 decimal places
  const MOVE_COIN_TYPE = '0x1::aptos_coin::AptosCoin';
  const WHALE_THRESHOLD = 10000;              // 10,000 MOVE = whale alert

  // Extract transfer data
  const eventData = trigger.eventData;
  const rawAmount = BigInt(eventData?.amount || '0');
  const amount = Number(rawAmount) / Math.pow(10, MOVE_DECIMALS);
  const sender = eventData?.account || trigger.transactionHash?.slice(0, 20);

  if (amount < WHALE_THRESHOLD) {
    console.log(\`Transfer of \${amount} MOVE below threshold, skipping\`);
    return { skipped: true, amount };
  }

  console.log(\`🐋 Whale alert! \${amount.toLocaleString()} MOVE transferred\`);

  // Categorize the whale
  let whaleSize = '';
  let emoji = '';
  if (amount >= 1000000) {
    whaleSize = 'MEGA WHALE';
    emoji = '🐋🐋🐋';
  } else if (amount >= 100000) {
    whaleSize = 'WHALE';
    emoji = '🐋🐋';
  } else if (amount >= 10000) {
    whaleSize = 'DOLPHIN';
    emoji = '🐬';
  }

  // Track whale activity
  const todayKey = \`whales_\${new Date().toISOString().split('T')[0]}\`;
  const todayStats = await kv.get(todayKey);
  const stats = todayStats ? JSON.parse(todayStats) : { count: 0, totalVolume: 0 };

  stats.count++;
  stats.totalVolume += amount;
  await kv.set(todayKey, JSON.stringify(stats));

  // Format message
  const message = \`\${emoji} *\${whaleSize} ALERT*

💰 *Amount:* \${amount.toLocaleString()} MOVE
📍 *Network:* \${network}
🔗 *TX:* \\\`\${trigger.transactionHash || 'Unknown'}\\\`

📊 *Today's Whale Activity:*
• Total Transfers: \${stats.count}
• Total Volume: \${stats.totalVolume.toLocaleString()} MOVE\`;

  // Send Telegram alert
  if (secrets.TELEGRAM_BOT_TOKEN && secrets.TELEGRAM_CHAT_ID) {
    await fetch(\`https://api.telegram.org/bot\${secrets.TELEGRAM_BOT_TOKEN}/sendMessage\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: secrets.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    console.log('Sent Telegram whale alert');
  }

  return {
    detected: true,
    amount,
    whaleSize,
    todayCount: stats.count,
    todayVolume: stats.totalVolume,
  };
}
`,
};

// ============================================================================
// GOVERNANCE MONITOR TEMPLATE
// ============================================================================

const governanceMonitorTemplate: ActionTemplate = {
  id: 'governance-monitor',
  name: 'DAO Governance Monitor',
  description:
    'Track DAO proposals and votes. Get notified when new proposals are created or when voting ends soon.',
  category: 'defi',
  triggerType: 'event',
  triggerConfig: {
    type: 'event',
    eventType: '0x1::aptos_governance::CreateProposalEvent',
  },
  requiredSecrets: [
    {
      name: 'DISCORD_WEBHOOK_URL',
      description: 'Discord webhook for governance updates',
    },
  ],
  network: 'mainnet',
  difficulty: 'intermediate',
  code: `/**
 * DAO Governance Monitor
 *
 * Monitors governance proposal events and sends alerts for:
 * - New proposals created
 * - Voting deadline approaching
 * - Proposal execution
 *
 * Trigger: On CreateProposalEvent
 */

async function main(ctx) {
  const { trigger, kv, secrets, network } = ctx;

  // Extract proposal data
  const eventData = trigger.eventData;
  const proposalId = eventData?.proposal_id;
  const proposer = eventData?.proposer;
  const executionHash = eventData?.execution_hash;

  console.log(\`New governance proposal detected: #\${proposalId}\`);

  // Store proposal for tracking
  const proposalKey = \`proposal_\${proposalId}\`;
  await kv.set(proposalKey, JSON.stringify({
    id: proposalId,
    proposer,
    executionHash,
    createdAt: new Date().toISOString(),
    txHash: trigger.transactionHash,
  }));

  // Update proposal count
  const countStr = await kv.get('proposal_count');
  const count = countStr ? parseInt(countStr) + 1 : 1;
  await kv.set('proposal_count', count.toString());

  // Send Discord notification
  if (secrets.DISCORD_WEBHOOK_URL) {
    const embed = {
      title: '🗳️ New Governance Proposal',
      color: 0x3b82f6, // Blue
      fields: [
        {
          name: 'Proposal ID',
          value: \`#\${proposalId}\`,
          inline: true,
        },
        {
          name: 'Proposer',
          value: proposer ? \`\\\`\${proposer.slice(0, 10)}...\${proposer.slice(-8)}\\\`\` : 'Unknown',
          inline: true,
        },
        {
          name: 'Network',
          value: network.charAt(0).toUpperCase() + network.slice(1),
          inline: true,
        },
        {
          name: 'Transaction',
          value: trigger.transactionHash
            ? \`[\\\`\${trigger.transactionHash.slice(0, 10)}...\\\`](https://explorer.movementnetwork.xyz/txn/\${trigger.transactionHash})\`
            : 'Unknown',
          inline: false,
        },
      ],
      footer: {
        text: \`Total proposals tracked: \${count}\`,
      },
      timestamp: new Date().toISOString(),
    };

    await fetch(secrets.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    console.log('Sent governance notification to Discord');
  }

  return {
    proposalId,
    proposer,
    totalProposals: count,
  };
}
`,
};

// ============================================================================
// EXPORTS
// ============================================================================

export const actionTemplates: ActionTemplate[] = [
  dexArbitrageTemplate,
  liquidationBotTemplate,
  treasuryMonitorTemplate,
  nftMintDetectorTemplate,
  whaleWatcherTemplate,
  governanceMonitorTemplate,
];

export function getTemplateById(id: string): ActionTemplate | undefined {
  return actionTemplates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: ActionTemplate['category']): ActionTemplate[] {
  return actionTemplates.filter((t) => t.category === category);
}

export function getTemplatesByDifficulty(difficulty: ActionTemplate['difficulty']): ActionTemplate[] {
  return actionTemplates.filter((t) => t.difficulty === difficulty);
}
