/**
 * Market Data Service
 *
 * Provides historical price, volume, and market context for tokens.
 * This helps identify suspicious transactions involving:
 * - Tokens with no liquidity
 * - Sudden price movements (potential manipulation)
 * - Low-cap/unverified tokens
 *
 * Data Sources:
 * - CoinGecko API (free tier)
 * - Movement Network Indexer (on-chain data)
 *
 * This adds important CONTEXT to security analysis:
 * - A "safe" transaction with an unknown token is still risky
 * - Large transfers of low-liquidity tokens are suspicious
 * - Price spikes before/after transactions indicate manipulation
 */

import type { RiskSeverity, Network } from '@movewatch/shared';
import type { DetectedIssue } from './types.js';
import { CONFIDENCE_LEVELS } from './utils.js';

// Token market data
export interface TokenMarketData {
  tokenAddress: string;
  symbol?: string;
  name?: string;
  priceUsd?: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  liquidity?: number;
  verified: boolean;
  lastUpdated: Date;
  source: 'coingecko' | 'indexer' | 'cache' | 'unknown';
}

// Market context analysis result
export interface MarketContextResult {
  tokensAnalyzed: number;
  tokenData: TokenMarketData[];
  issues: DetectedIssue[];
  riskFactors: {
    hasUnknownTokens: boolean;
    hasLowLiquidity: boolean;
    hasPriceVolatility: boolean;
    totalValueAtRisk: number;
  };
}

// Token info cache (simple in-memory cache)
const tokenCache = new Map<string, { data: TokenMarketData; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Known token mappings for Movement/Aptos
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; coingeckoId?: string }> = {
  '0x1::aptos_coin::AptosCoin': {
    symbol: 'APT',
    name: 'Aptos',
    coingeckoId: 'aptos',
  },
  '0x1::aptos_coin::MOVE': {
    symbol: 'MOVE',
    name: 'Movement',
    coingeckoId: 'movement',
  },
  // Add more known tokens as they become available
};

// Risk thresholds
const RISK_THRESHOLDS = {
  lowLiquidity: 10000, // < $10k liquidity is concerning
  highVolatility: 20, // > 20% price change in 24h
  lowMarketCap: 100000, // < $100k market cap
  largeTxRatio: 0.1, // Transaction > 10% of liquidity
};

/**
 * Fetch token data from CoinGecko
 */
async function fetchFromCoinGecko(coingeckoId: string): Promise<Partial<TokenMarketData> | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('CoinGecko rate limited');
      }
      return null;
    }

    // CoinGecko API response type
    interface CoinGeckoResponse {
      symbol?: string;
      name?: string;
      market_data?: {
        current_price?: { usd?: number };
        price_change_percentage_24h?: number;
        total_volume?: { usd?: number };
        market_cap?: { usd?: number };
      };
    }

    const data = (await response.json()) as CoinGeckoResponse;

    return {
      symbol: data.symbol?.toUpperCase(),
      name: data.name,
      priceUsd: data.market_data?.current_price?.usd,
      priceChange24h: data.market_data?.price_change_percentage_24h,
      volume24h: data.market_data?.total_volume?.usd,
      marketCap: data.market_data?.market_cap?.usd,
      liquidity: data.market_data?.total_volume?.usd, // Use volume as liquidity proxy
      verified: true,
      source: 'coingecko' as const,
    };
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return null;
  }
}

/**
 * Get token market data
 */
export async function getTokenMarketData(tokenAddress: string): Promise<TokenMarketData> {
  // Check cache
  const cached = tokenCache.get(tokenAddress);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, source: 'cache' };
  }

  // Check if it's a known token
  const knownToken = KNOWN_TOKENS[tokenAddress];

  if (knownToken?.coingeckoId) {
    const coingeckoData = await fetchFromCoinGecko(knownToken.coingeckoId);

    if (coingeckoData) {
      const data: TokenMarketData = {
        tokenAddress,
        symbol: coingeckoData.symbol || knownToken.symbol,
        name: coingeckoData.name || knownToken.name,
        priceUsd: coingeckoData.priceUsd,
        priceChange24h: coingeckoData.priceChange24h,
        volume24h: coingeckoData.volume24h,
        marketCap: coingeckoData.marketCap,
        liquidity: coingeckoData.liquidity,
        verified: true,
        lastUpdated: new Date(),
        source: 'coingecko',
      };

      // Cache the result
      tokenCache.set(tokenAddress, { data, expires: Date.now() + CACHE_TTL_MS });

      return data;
    }
  }

  // Return unknown token data
  const unknownData: TokenMarketData = {
    tokenAddress,
    symbol: knownToken?.symbol,
    name: knownToken?.name,
    verified: !!knownToken,
    lastUpdated: new Date(),
    source: 'unknown',
  };

  return unknownData;
}

/**
 * Extract token addresses from function call
 */
function extractTokenAddresses(
  typeArguments: string[],
  functionName: string
): string[] {
  const tokens: string[] = [];

  // Type arguments often contain token types
  for (const typeArg of typeArguments) {
    if (typeArg.includes('::')) {
      tokens.push(typeArg);
    }
  }

  // Extract from function name if it's a token-related function
  const coinMatch = functionName.match(/0x[a-fA-F0-9]+::\w+::\w+<([^>]+)>/);
  if (coinMatch) {
    tokens.push(coinMatch[1]);
  }

  return [...new Set(tokens)]; // Deduplicate
}

/**
 * Analyze market context for a transaction
 */
export async function analyzeMarketContext(data: {
  functionName: string;
  typeArguments: string[];
  arguments: unknown[];
  estimatedValue?: number; // In token units
}): Promise<MarketContextResult> {
  const issues: DetectedIssue[] = [];

  // Extract token addresses
  const tokenAddresses = extractTokenAddresses(data.typeArguments, data.functionName);

  if (tokenAddresses.length === 0) {
    return {
      tokensAnalyzed: 0,
      tokenData: [],
      issues: [],
      riskFactors: {
        hasUnknownTokens: false,
        hasLowLiquidity: false,
        hasPriceVolatility: false,
        totalValueAtRisk: 0,
      },
    };
  }

  // Fetch market data for each token
  const tokenDataPromises = tokenAddresses.map(getTokenMarketData);
  const tokenData = await Promise.all(tokenDataPromises);

  // Analyze risk factors
  let hasUnknownTokens = false;
  let hasLowLiquidity = false;
  let hasPriceVolatility = false;
  let totalValueAtRisk = 0;

  for (const token of tokenData) {
    // Check for unknown/unverified tokens
    if (!token.verified || token.source === 'unknown') {
      hasUnknownTokens = true;
      issues.push({
        patternId: 'market:unknown_token',
        category: 'RUG_PULL',
        severity: 'HIGH',
        title: 'Unknown/Unverified Token',
        description: `The token ${token.tokenAddress} is not recognized or verified. Unknown tokens carry higher risk of scams and rug pulls.`,
        recommendation: 'Only interact with verified tokens from trusted sources. Research the token thoroughly before proceeding.',
        confidence: CONFIDENCE_LEVELS.HIGH,
        source: 'pattern' as const,
        evidence: {
          tokenAddress: token.tokenAddress,
          verified: false,
          marketDataAvailable: false,
        },
      });
    }

    // Check for low liquidity
    if (token.liquidity !== undefined && token.liquidity < RISK_THRESHOLDS.lowLiquidity) {
      hasLowLiquidity = true;
      issues.push({
        patternId: 'market:low_liquidity',
        category: 'EXPLOIT',
        severity: 'MEDIUM',
        title: 'Low Liquidity Token',
        description: `${token.symbol || token.tokenAddress} has low liquidity ($${token.liquidity?.toLocaleString() || 'unknown'}). Low liquidity tokens are vulnerable to price manipulation.`,
        recommendation: 'Be cautious with low liquidity tokens. Large trades can significantly impact price.',
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        source: 'pattern' as const,
        evidence: {
          tokenAddress: token.tokenAddress,
          symbol: token.symbol,
          liquidity: token.liquidity,
          threshold: RISK_THRESHOLDS.lowLiquidity,
        },
      });
    }

    // Check for price volatility
    if (
      token.priceChange24h !== undefined &&
      Math.abs(token.priceChange24h) > RISK_THRESHOLDS.highVolatility
    ) {
      hasPriceVolatility = true;
      issues.push({
        patternId: 'market:high_volatility',
        category: 'EXPLOIT',
        severity: token.priceChange24h > 0 ? 'MEDIUM' : 'HIGH',
        title: 'High Price Volatility',
        description: `${token.symbol || token.tokenAddress} has ${token.priceChange24h > 0 ? 'increased' : 'decreased'} ${Math.abs(token.priceChange24h).toFixed(1)}% in the last 24 hours. High volatility may indicate manipulation.`,
        recommendation: 'Extreme price movements can indicate pump-and-dump schemes or market manipulation.',
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        source: 'pattern' as const,
        evidence: {
          tokenAddress: token.tokenAddress,
          symbol: token.symbol,
          priceChange24h: token.priceChange24h,
          threshold: RISK_THRESHOLDS.highVolatility,
        },
      });
    }

    // Calculate value at risk
    if (token.priceUsd && data.estimatedValue) {
      totalValueAtRisk += token.priceUsd * data.estimatedValue;
    }
  }

  return {
    tokensAnalyzed: tokenData.length,
    tokenData,
    issues,
    riskFactors: {
      hasUnknownTokens,
      hasLowLiquidity,
      hasPriceVolatility,
      totalValueAtRisk,
    },
  };
}

/**
 * Get market data statistics
 */
export function getMarketDataStats(): {
  knownTokens: number;
  cachedTokens: number;
  cacheHitRate: number;
} {
  return {
    knownTokens: Object.keys(KNOWN_TOKENS).length,
    cachedTokens: tokenCache.size,
    cacheHitRate: 0, // Would need to track hits/misses
  };
}

export { KNOWN_TOKENS, RISK_THRESHOLDS };
