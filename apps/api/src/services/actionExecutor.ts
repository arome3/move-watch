// NOTE: isolated-vm v6.0.2+ supports Node.js 24
// IMPORTANT: Run Node.js with --no-node-snapshot flag for v20+
import ivm from 'isolated-vm';
import ts from 'typescript';
import { Account, Ed25519PrivateKey, Aptos, AptosConfig, Network as AptosNetwork } from '@aptos-labs/ts-sdk';
import { getMovementClient } from '../lib/movement.js';
import { NETWORK_CONFIGS, type Network } from '@movewatch/shared';
import type { ActionExecutionContext } from '@movewatch/shared';
import { redis } from '../lib/redis.js';
import { validateUrlForSSRF } from '../lib/ssrfProtection.js';

const DEFAULT_MEMORY_LIMIT_MB = 128;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TRANSACTIONS_PER_EXECUTION = 5; // Safety limit
const MAX_GAS_PER_TRANSACTION = 100000;   // Cap gas to prevent draining

export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  logs: string[];
  error?: {
    message: string;
    stack?: string;
  };
  durationMs: number;
  memoryUsedMb: number;
}

export interface ExecutorOptions {
  memoryLimitMb?: number;
  timeoutMs?: number;
}

/**
 * Action Executor - Sandboxed execution engine using isolated-vm
 *
 * Executes user TypeScript/JavaScript code in a secure sandbox with:
 * - Memory isolation and limits
 * - Execution timeout enforcement
 * - Movement SDK access for on-chain reads
 * - Console.log capture
 * - Restricted fetch (HTTPS only)
 */
export class ActionExecutor {
  private memoryLimitMb: number;
  private timeoutMs: number;

  constructor(options: ExecutorOptions = {}) {
    this.memoryLimitMb = options.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Execute user code in a sandboxed environment
   */
  async execute(
    code: string,
    context: ActionExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    let isolate: ivm.Isolate | null = null;

    try {
      // Create isolated VM with memory limit
      isolate = new ivm.Isolate({ memoryLimit: this.memoryLimitMb });
      const vmContext = await isolate.createContext();

      // Set up the global jail
      const jail = vmContext.global;
      await jail.set('global', jail.derefInto());

      // Inject console.log capture
      await this.injectConsole(vmContext, logs);

      // Inject execution context
      await this.injectContext(vmContext, context);

      // Inject Movement SDK (now with transaction signing)
      await this.injectMovementSDK(vmContext, context.network, context);

      // Inject KV storage for state persistence
      await this.injectStorage(vmContext, context.actionId);

      // Inject restricted fetch
      await this.injectFetch(vmContext);

      // Transpile TypeScript to JavaScript
      const jsCode = this.transpileTypeScript(code);

      // Wrap user code to capture exports and execute handler
      const wrappedCode = this.wrapUserCode(jsCode);

      // Compile and run with timeout
      const script = await isolate.compileScript(wrappedCode);

      // Use promise: true to properly handle async scripts that return promises
      const resultPromise = script.run(vmContext, {
        timeout: this.timeoutMs,
        promise: true,  // Essential for async user code
      });

      // Race against timeout
      const result = await Promise.race([
        resultPromise,
        this.createTimeout(this.timeoutMs),
      ]);

      const durationMs = Date.now() - startTime;
      const memoryUsedMb = this.getMemoryUsage(isolate);

      // Parse result if it's a string (JSON)
      let parsedResult = result;
      if (typeof result === 'string') {
        try {
          parsedResult = JSON.parse(result);
        } catch {
          // Keep as string if not JSON
        }
      }

      return {
        success: true,
        result: parsedResult,
        logs,
        durationMs,
        memoryUsedMb,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const memoryUsedMb = isolate ? this.getMemoryUsage(isolate) : 0;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('Script execution timed out');

      return {
        success: false,
        logs,
        error: {
          message: isTimeout ? 'Execution timeout exceeded' : errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        durationMs,
        memoryUsedMb,
      };
    } finally {
      // Clean up isolate
      if (isolate) {
        try {
          isolate.dispose();
        } catch {
          // Ignore disposal errors
        }
      }
    }
  }

  /**
   * Transpile TypeScript to JavaScript
   */
  private transpileTypeScript(code: string): string {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
    });
    return result.outputText;
  }

  /**
   * Wrap user code to handle exports and async execution
   */
  private wrapUserCode(jsCode: string): string {
    // Use __userHandler to avoid conflicts with user code that may define 'handler'
    return `
      (async function() {
        // Initialize exports object
        const exports = {};
        const module = { exports: exports };

        // Execute user code
        ${jsCode}

        // Find and call the handler function
        // Use __userHandler to avoid conflicts with user-defined 'handler' function
        // Support: default export, 'handler', or 'run' named exports
        const __userHandler = exports.default || exports.handler || exports.run || module.exports.default || module.exports.handler || module.exports.run;

        if (typeof __userHandler !== 'function') {
          throw new Error('No handler function exported. Export a default function or named "handler" or "run".');
        }

        // Execute handler with context
        const __result = await __userHandler(__ctx);

        // Return JSON-serialized result
        return JSON.stringify(__result);
      })();
    `;
  }

  /**
   * Inject console methods that capture logs
   */
  private async injectConsole(context: ivm.Context, logs: string[]): Promise<void> {
    const jail = context.global;

    // Create log function reference
    const logFn = new ivm.Reference((level: string, ...args: unknown[]) => {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logs.push(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    });

    await jail.set('__logFn', logFn);

    await context.eval(`
      const console = {
        log: (...args) => __logFn.apply(undefined, ['info', ...args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))]),
        info: (...args) => __logFn.apply(undefined, ['info', ...args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))]),
        warn: (...args) => __logFn.apply(undefined, ['warn', ...args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))]),
        error: (...args) => __logFn.apply(undefined, ['error', ...args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))]),
        debug: (...args) => __logFn.apply(undefined, ['debug', ...args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))]),
      };
      global.console = console;
    `);
  }

  /**
   * Inject execution context (triggerData, secrets, network, etc.)
   */
  private async injectContext(
    context: ivm.Context,
    execCtx: ActionExecutionContext
  ): Promise<void> {
    const jail = context.global;

    // Create context object
    const ctxData = {
      actionId: execCtx.actionId,
      executionId: execCtx.executionId,
      network: execCtx.network,
      triggerType: execCtx.triggerType,
      triggerData: execCtx.triggerData,
      // Alias trigger for convenience (used in templates)
      trigger: execCtx.triggerData,
      secrets: execCtx.secrets,
    };

    // Set as external copy
    await jail.set('__ctx', new ivm.ExternalCopy(ctxData).copyInto());
  }

  /**
   * Inject Movement SDK methods including transaction signing
   */
  private async injectMovementSDK(
    context: ivm.Context,
    network: Network,
    execCtx: ActionExecutionContext
  ): Promise<void> {
    const jail = context.global;
    const client = getMovementClient(network);

    // Track transaction count for safety limiting
    let transactionCount = 0;

    // getAccountResource
    const getResourceFn = new ivm.Reference(async (address: string, resourceType: string) => {
      try {
        const resource = await client.getAccountResource({
          accountAddress: address,
          resourceType: resourceType as `${string}::${string}::${string}`,
        });
        return new ivm.ExternalCopy(resource).copyInto();
      } catch (error) {
        throw new Error(`Failed to get resource: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // getAccountResources
    const getResourcesFn = new ivm.Reference(async (address: string) => {
      try {
        const resources = await client.getAccountResources({
          accountAddress: address,
        });
        return new ivm.ExternalCopy(resources).copyInto();
      } catch (error) {
        throw new Error(`Failed to get resources: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // view (for view functions)
    const viewFn = new ivm.Reference(async (payloadStr: string) => {
      try {
        const payload = JSON.parse(payloadStr) as {
          function: string;
          typeArguments?: string[];
          arguments?: unknown[];
        };
        const result = await client.view({
          payload: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments ?? [],
            functionArguments: (payload.arguments ?? []) as any[],
          },
        });
        return new ivm.ExternalCopy(result).copyInto();
      } catch (error) {
        throw new Error(`View function failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // submitTransaction - allows actions to sign and submit transactions
    const submitTransactionFn = new ivm.Reference(async (payloadStr: string) => {
      try {
        // Safety limit check
        if (transactionCount >= MAX_TRANSACTIONS_PER_EXECUTION) {
          throw new Error(`Transaction limit exceeded (max ${MAX_TRANSACTIONS_PER_EXECUTION} per execution)`);
        }

        const payload = JSON.parse(payloadStr) as {
          function: string;
          typeArguments?: string[];
          arguments?: unknown[];
          maxGasAmount?: number;
        };

        // Get private key from secrets
        const privateKeyHex = execCtx.secrets?.PRIVATE_KEY || execCtx.secrets?.ACTION_PRIVATE_KEY;
        if (!privateKeyHex) {
          throw new Error('No PRIVATE_KEY or ACTION_PRIVATE_KEY secret configured. Add it in action settings.');
        }

        // Create account from private key
        const privateKey = new Ed25519PrivateKey(privateKeyHex);
        const account = Account.fromPrivateKey({ privateKey });

        // Cap gas amount for safety
        const maxGasAmount = Math.min(
          payload.maxGasAmount || MAX_GAS_PER_TRANSACTION,
          MAX_GAS_PER_TRANSACTION
        );

        // Build and submit transaction using Movement Network config
        // Movement uses custom chain IDs (250 for testnet) so we use CUSTOM network type
        const networkConfig = NETWORK_CONFIGS[network];
        const aptosConfig = new AptosConfig({
          network: AptosNetwork.CUSTOM,
          fullnode: networkConfig.fullnode,
        });
        const aptos = new Aptos(aptosConfig);

        const transaction = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments ?? [],
            functionArguments: (payload.arguments ?? []) as any[],
          },
          options: {
            maxGasAmount,
          },
        });

        const pendingTxn = await aptos.signAndSubmitTransaction({
          signer: account,
          transaction,
        });

        // Wait for transaction confirmation
        const result = await aptos.waitForTransaction({
          transactionHash: pendingTxn.hash,
        });

        transactionCount++;

        console.log(
          `[ActionExecutor] Transaction submitted: ${pendingTxn.hash} ` +
            `(${transactionCount}/${MAX_TRANSACTIONS_PER_EXECUTION})`
        );

        return new ivm.ExternalCopy({
          hash: pendingTxn.hash,
          success: result.success,
          vmStatus: result.vm_status,
          gasUsed: result.gas_used,
          sender: account.accountAddress.toString(),
        }).copyInto();
      } catch (error) {
        throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // getBalance - convenience method for checking account balance
    const getBalanceFn = new ivm.Reference(async (address: string, coinType?: string) => {
      try {
        const tokenType = coinType || '0x1::aptos_coin::AptosCoin';
        const coinStoreType = `0x1::coin::CoinStore<${tokenType}>`;

        const resource = await client.getAccountResource({
          accountAddress: address,
          resourceType: coinStoreType as `${string}::${string}::${string}`,
        });

        const balance = (resource as { coin: { value: string } }).coin.value;
        return new ivm.ExternalCopy({ balance, coinType: tokenType }).copyInto();
      } catch (error) {
        // Account might not have this coin registered
        return new ivm.ExternalCopy({ balance: '0', coinType: coinType || '0x1::aptos_coin::AptosCoin' }).copyInto();
      }
    });

    // getAccountInfo - check if account exists and get sequence number
    const getAccountInfoFn = new ivm.Reference(async (address: string) => {
      try {
        const account = await client.getAccountInfo({
          accountAddress: address,
        });
        return new ivm.ExternalCopy({
          exists: true,
          sequenceNumber: account.sequence_number,
          authenticationKey: account.authentication_key,
        }).copyInto();
      } catch (error) {
        // Account doesn't exist
        return new ivm.ExternalCopy({
          exists: false,
          sequenceNumber: '0',
          authenticationKey: null,
        }).copyInto();
      }
    });

    // getLedgerInfo - get current block height and timestamp
    const getLedgerInfoFn = new ivm.Reference(async () => {
      try {
        const info = await client.getLedgerInfo();
        return new ivm.ExternalCopy({
          chainId: info.chain_id,
          epoch: info.epoch,
          blockHeight: info.block_height,
          ledgerVersion: info.ledger_version,
          ledgerTimestamp: info.ledger_timestamp,
          nodeRole: info.node_role,
        }).copyInto();
      } catch (error) {
        throw new Error(`Failed to get ledger info: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // getEvents - query events by event handle
    const getEventsFn = new ivm.Reference(async (address: string, eventHandle: string, fieldName: string, limit?: number) => {
      try {
        const events = await client.getAccountEventsByEventType({
          accountAddress: address,
          eventType: eventHandle as `${string}::${string}::${string}`,
          options: { limit: limit || 25 },
        });
        return new ivm.ExternalCopy(events).copyInto();
      } catch (error) {
        throw new Error(`Failed to get events: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // getTableItem - read from Move table
    const getTableItemFn = new ivm.Reference(async (tableHandle: string, keyType: string, valueType: string, key: unknown) => {
      try {
        const item = await client.getTableItem<unknown>({
          handle: tableHandle,
          data: {
            key_type: keyType,
            value_type: valueType,
            key: key,
          },
        });
        return new ivm.ExternalCopy(item).copyInto();
      } catch (error) {
        // Table item might not exist
        return new ivm.ExternalCopy(null).copyInto();
      }
    });

    await jail.set('__getResource', getResourceFn);
    await jail.set('__getResources', getResourcesFn);
    await jail.set('__view', viewFn);
    await jail.set('__submitTransaction', submitTransactionFn);
    await jail.set('__getBalance', getBalanceFn);
    await jail.set('__getAccountInfo', getAccountInfoFn);
    await jail.set('__getLedgerInfo', getLedgerInfoFn);
    await jail.set('__getEvents', getEventsFn);
    await jail.set('__getTableItem', getTableItemFn);

    await context.eval(`
      const movement = {
        // Core SDK methods
        getResource: async (address, resourceType) => {
          return await __getResource.apply(undefined, [address, resourceType], { result: { promise: true } });
        },
        getResources: async (address) => {
          return await __getResources.apply(undefined, [address], { result: { promise: true } });
        },
        view: async (payload) => {
          return await __view.apply(undefined, [JSON.stringify(payload)], { result: { promise: true } });
        },
        submitTransaction: async (payload) => {
          return await __submitTransaction.apply(undefined, [JSON.stringify(payload)], { result: { promise: true } });
        },
        getBalance: async (address, coinType) => {
          return await __getBalance.apply(undefined, [address, coinType], { result: { promise: true } });
        },

        // Account helpers
        getAccountInfo: async (address) => {
          return await __getAccountInfo.apply(undefined, [address], { result: { promise: true } });
        },
        accountExists: async (address) => {
          const info = await __getAccountInfo.apply(undefined, [address], { result: { promise: true } });
          return info.exists;
        },

        // Chain info helpers
        getLedgerInfo: async () => {
          return await __getLedgerInfo.apply(undefined, [], { result: { promise: true } });
        },
        getBlockHeight: async () => {
          const info = await __getLedgerInfo.apply(undefined, [], { result: { promise: true } });
          return parseInt(info.blockHeight, 10);
        },

        // Event helpers
        getEvents: async (address, eventHandle, fieldName, limit) => {
          return await __getEvents.apply(undefined, [address, eventHandle, fieldName, limit], { result: { promise: true } });
        },

        // Table helpers (for AMM pools, etc.)
        getTableItem: async (tableHandle, keyType, valueType, key) => {
          return await __getTableItem.apply(undefined, [tableHandle, keyType, valueType, key], { result: { promise: true } });
        },

        // Movement-specific helpers
        helpers: {
          // Parse coin type from full type string
          // e.g., "0x1::aptos_coin::AptosCoin" -> { address: "0x1", module: "aptos_coin", struct: "AptosCoin" }
          parseCoinType: (coinType) => {
            const parts = coinType.split('::');
            if (parts.length !== 3) return null;
            return { address: parts[0], module: parts[1], struct: parts[2] };
          },

          // Format amount with decimals
          // e.g., formatAmount("1000000000", 8) -> "10.0"
          formatAmount: (amount, decimals = 8) => {
            const value = BigInt(amount);
            const divisor = BigInt(10 ** decimals);
            const whole = value / divisor;
            const fraction = value % divisor;
            const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
            return fractionStr ? whole.toString() + '.' + fractionStr : whole.toString();
          },

          // Parse amount to raw units
          // e.g., parseAmount("10.5", 8) -> "1050000000"
          parseAmount: (amount, decimals = 8) => {
            const [whole, fraction = ''] = amount.split('.');
            const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
            return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFraction)).toString();
          },

          // Truncate address for display
          // e.g., "0x1234567890abcdef" -> "0x1234...cdef"
          truncateAddress: (address, start = 6, end = 4) => {
            if (address.length <= start + end + 3) return address;
            return address.slice(0, start) + '...' + address.slice(-end);
          },

          // Common coin types on Movement (verified addresses)
          // LayerZero bridge: 0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa
          coins: {
            // Native MOVE token (Coin standard)
            MOVE: '0x1::aptos_coin::AptosCoin',
            // MOVE as Fungible Asset (FA standard)
            MOVE_FA: '0x42afc6935b692cd286e3087a4464ec516a60dd21c9e355e1b8b0088376501372',
            // LayerZero bridged stablecoins (via Movement Bridge)
            USDC: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
            USDT: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT',
            // LayerZero bridged crypto assets
            WETH: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH',
            WBTC: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC',
            // Legacy alias
            ETH: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH',
          },

          // Common protocol addresses on Movement
          protocols: {
            // Echelon Lending Protocol
            ECHELON: '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba',
            // LayerZero OFT Bridge
            LAYERZERO_BRIDGE: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa',
          },

          // Token decimals reference
          decimals: {
            MOVE: 8,
            USDC: 6,
            USDT: 6,
            WETH: 8,
            WBTC: 8,
          },

          // DEX pool helpers
          dex: {
            // Calculate output amount for constant product AMM
            // Uses x * y = k formula
            getAmountOut: (amountIn, reserveIn, reserveOut, feeBps = 30) => {
              const amountInBig = BigInt(amountIn);
              const reserveInBig = BigInt(reserveIn);
              const reserveOutBig = BigInt(reserveOut);
              const feeMultiplier = BigInt(10000 - feeBps);

              const amountInWithFee = amountInBig * feeMultiplier;
              const numerator = amountInWithFee * reserveOutBig;
              const denominator = reserveInBig * BigInt(10000) + amountInWithFee;

              return (numerator / denominator).toString();
            },

            // Calculate input amount needed for desired output
            getAmountIn: (amountOut, reserveIn, reserveOut, feeBps = 30) => {
              const amountOutBig = BigInt(amountOut);
              const reserveInBig = BigInt(reserveIn);
              const reserveOutBig = BigInt(reserveOut);
              const feeMultiplier = BigInt(10000 - feeBps);

              const numerator = reserveInBig * amountOutBig * BigInt(10000);
              const denominator = (reserveOutBig - amountOutBig) * feeMultiplier;

              return ((numerator / denominator) + BigInt(1)).toString();
            },

            // Calculate price impact percentage
            getPriceImpact: (amountIn, reserveIn, reserveOut) => {
              const amountInBig = BigInt(amountIn);
              const reserveInBig = BigInt(reserveIn);
              const reserveOutBig = BigInt(reserveOut);

              // Spot price = reserveOut / reserveIn
              // Execution price = amountOut / amountIn
              const k = reserveInBig * reserveOutBig;
              const newReserveIn = reserveInBig + amountInBig;
              const newReserveOut = k / newReserveIn;
              const amountOut = reserveOutBig - newReserveOut;

              const spotPrice = Number(reserveOutBig) / Number(reserveInBig);
              const executionPrice = Number(amountOut) / Number(amountInBig);

              return ((spotPrice - executionPrice) / spotPrice * 100).toFixed(4);
            },
          },

          // Time helpers
          time: {
            now: () => Date.now(),
            nowSeconds: () => Math.floor(Date.now() / 1000),
            formatTimestamp: (timestamp) => new Date(timestamp).toISOString(),
            secondsAgo: (seconds) => Date.now() - seconds * 1000,
            minutesAgo: (minutes) => Date.now() - minutes * 60 * 1000,
            hoursAgo: (hours) => Date.now() - hours * 60 * 60 * 1000,
          },
        },

        network: '${network}',
      };
      __ctx.movement = movement;

      // Expose common helpers at context root for convenience
      __ctx.helpers = movement.helpers;
    `);
  }

  /**
   * Inject KV storage for action state persistence
   * Uses Redis with action-scoped keys
   */
  private async injectStorage(
    context: ivm.Context,
    actionId: string
  ): Promise<void> {
    const jail = context.global;
    const keyPrefix = `action:${actionId}:kv:`;
    const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

    // storage.set
    const storageSeFn = new ivm.Reference(async (key: string, valueStr: string) => {
      try {
        const fullKey = `${keyPrefix}${key}`;
        await redis.setex(fullKey, TTL_SECONDS, valueStr);
        return true;
      } catch (error) {
        console.error(`[Storage] Set failed for ${key}:`, error);
        throw new Error(`Storage set failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // storage.get
    const storageGetFn = new ivm.Reference(async (key: string) => {
      try {
        const fullKey = `${keyPrefix}${key}`;
        const value = await redis.get(fullKey);
        return value !== null ? new ivm.ExternalCopy(value).copyInto() : null;
      } catch (error) {
        console.error(`[Storage] Get failed for ${key}:`, error);
        throw new Error(`Storage get failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // storage.delete
    const storageDeleteFn = new ivm.Reference(async (key: string) => {
      try {
        const fullKey = `${keyPrefix}${key}`;
        await redis.del(fullKey);
        return true;
      } catch (error) {
        console.error(`[Storage] Delete failed for ${key}:`, error);
        throw new Error(`Storage delete failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // storage.list - get all keys for this action
    const storageListFn = new ivm.Reference(async () => {
      try {
        const keys = await redis.keys(`${keyPrefix}*`);
        const strippedKeys = keys.map((k: string) => k.replace(keyPrefix, ''));
        return new ivm.ExternalCopy(strippedKeys).copyInto();
      } catch (error) {
        console.error(`[Storage] List failed:`, error);
        throw new Error(`Storage list failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    await jail.set('__storageSet', storageSeFn);
    await jail.set('__storageGet', storageGetFn);
    await jail.set('__storageDelete', storageDeleteFn);
    await jail.set('__storageList', storageListFn);

    await context.eval(`
      const storage = {
        set: async (key, value) => {
          const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
          return await __storageSet.apply(undefined, [key, serialized], { result: { promise: true } });
        },
        get: async (key) => {
          const value = await __storageGet.apply(undefined, [key], { result: { promise: true } });
          if (value === null) return null;
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        },
        delete: async (key) => {
          return await __storageDelete.apply(undefined, [key], { result: { promise: true } });
        },
        list: async () => {
          return await __storageList.apply(undefined, [], { result: { promise: true } });
        },
      };
      __ctx.storage = storage;
      // Alias kv for convenience (matches template naming)
      __ctx.kv = storage;
    `);
  }

  /**
   * Inject restricted fetch with SSRF protection
   * SECURITY: Validates URLs against internal networks, DNS rebinding, and cloud metadata
   */
  private async injectFetch(context: ivm.Context): Promise<void> {
    const jail = context.global;

    const fetchFn = new ivm.Reference(async (url: string, optionsStr?: string) => {
      // Parse options if provided
      let options: RequestInit | undefined;
      if (optionsStr) {
        try {
          options = JSON.parse(optionsStr);
        } catch {
          // Invalid options, ignore
        }
      }

      // SSRF Protection: Validate URL comprehensively
      // Checks: protocol, hostname blocklist, DNS resolution to private IPs
      const validation = await validateUrlForSSRF(url, false); // false = HTTPS only
      if (!validation.valid) {
        throw new Error(`SSRF Protection: ${validation.error}`);
      }

      try {
        // Perform fetch with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          redirect: 'manual', // Don't follow redirects automatically (SSRF protection)
        });

        clearTimeout(timeout);

        // Check for redirects and validate redirect URL
        if (response.status >= 300 && response.status < 400) {
          const redirectUrl = response.headers.get('location');
          if (redirectUrl) {
            const absoluteRedirectUrl = new URL(redirectUrl, url).toString();
            const redirectValidation = await validateUrlForSSRF(absoluteRedirectUrl, false);
            if (!redirectValidation.valid) {
              throw new Error(`SSRF Protection: Redirect blocked - ${redirectValidation.error}`);
            }
            // Return redirect info to user code
            return new ivm.ExternalCopy({
              ok: false,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              text: `Redirect to: ${absoluteRedirectUrl}`,
              json: null,
              redirectUrl: absoluteRedirectUrl,
            }).copyInto();
          }
        }

        // Get response data
        const text = await response.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // Not JSON
        }

        return new ivm.ExternalCopy({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          text,
          json,
        }).copyInto();
      } catch (error) {
        throw new Error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    await jail.set('__fetch', fetchFn);

    await context.eval(`
      globalThis.fetch = async (url, options) => {
        const result = await __fetch.apply(undefined, [url, options ? JSON.stringify(options) : undefined], { result: { promise: true } });
        return {
          ok: result.ok,
          status: result.status,
          statusText: result.statusText,
          headers: new Map(Object.entries(result.headers || {})),
          text: async () => result.text,
          json: async () => result.json,
          redirectUrl: result.redirectUrl, // Available if redirect occurred
        };
      };
    `);
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Script execution timed out'));
      }, ms);
    });
  }

  /**
   * Get memory usage from isolate
   */
  private getMemoryUsage(isolate: ivm.Isolate): number {
    try {
      const stats = isolate.getHeapStatisticsSync();
      return Math.round(stats.used_heap_size / (1024 * 1024) * 100) / 100;
    } catch {
      return 0;
    }
  }
}

/**
 * Create an executor instance with default options
 */
export function createExecutor(options?: ExecutorOptions): ActionExecutor {
  return new ActionExecutor(options);
}

/**
 * Execute action code with a fresh executor (convenience function)
 */
export async function executeAction(
  code: string,
  context: ActionExecutionContext,
  options?: ExecutorOptions
): Promise<ExecutionResult> {
  const executor = new ActionExecutor(options);
  return executor.execute(code, context);
}
