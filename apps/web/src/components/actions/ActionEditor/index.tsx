'use client';

import { useCallback, useRef } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type { editor, Uri } from 'monaco-editor';

interface ActionEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  onValidate?: (markers: editor.IMarkerData[]) => void;
}

// TypeScript definitions for the action context
const ACTION_CONTEXT_TYPES = `
// ============================================================================
// ACTION EXECUTION CONTEXT
// ============================================================================

interface ActionContext {
  /** Unique identifier for this action */
  actionId: string;
  /** Unique identifier for this execution */
  executionId: string;
  /** Network this action is running on */
  network: 'mainnet' | 'testnet' | 'devnet';
  /** Type of trigger that started this execution */
  triggerType: 'event' | 'block' | 'schedule' | 'webhook';
  /** Data from the trigger */
  triggerData: TriggerData;
  /** User-defined secrets (key-value pairs) */
  secrets: Record<string, string>;
  /** Movement Network SDK for on-chain operations */
  movement: MovementSDK;
  /** Key-value storage for state persistence (Redis-backed) */
  kv: KVStorage;
}

// ============================================================================
// TRIGGER DATA TYPES
// ============================================================================

type TriggerData = EventTriggerData | BlockTriggerData | ScheduleTriggerData | WebhookTriggerData;

interface EventTriggerData {
  type: 'event';
  eventType: string;
  eventData: unknown;
  transactionHash?: string;
  matchedAt: string;
}

interface BlockTriggerData {
  type: 'block';
  blockHeight: number;
  blockTime: string;
  blockHash: string;
  matchedAt: string;
}

interface ScheduleTriggerData {
  type: 'schedule';
  cron: string;
  timezone: string;
  triggeredAt: string;
}

interface WebhookTriggerData {
  type: 'webhook';
  method: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  ip: string;
  triggeredAt: string;
}

// ============================================================================
// MOVEMENT SDK
// ============================================================================

interface MovementSDK {
  /** Get a specific resource from an account */
  getResource<T = unknown>(address: string, resourceType: string): Promise<T>;
  /** Get all resources from an account */
  getResources(address: string): Promise<unknown[]>;
  /** Call a view function on the blockchain */
  view<T = unknown>(payload: ViewPayload): Promise<T>;
  /** Sign and submit a transaction (requires PRIVATE_KEY secret) */
  submitTransaction(payload: TransactionPayload): Promise<TransactionResult>;
  /** Get account balance for a specific coin */
  getBalance(address: string, coinType?: string): Promise<BalanceInfo>;
  /** Get account info (existence check, sequence number) */
  getAccountInfo(address: string): Promise<AccountInfo>;
  /** Check if an account exists */
  accountExists(address: string): Promise<boolean>;
  /** Get current ledger/chain info */
  getLedgerInfo(): Promise<LedgerInfo>;
  /** Get current block height */
  getBlockHeight(): Promise<number>;
  /** Query events by type */
  getEvents(address: string, eventType: string, fieldName: string, limit?: number): Promise<unknown[]>;
  /** Read from a Move table */
  getTableItem<T = unknown>(tableHandle: string, keyType: string, valueType: string, key: unknown): Promise<T | null>;
  /** Helper utilities */
  helpers: MovementHelpers;
  /** Current network */
  network: string;
}

interface ViewPayload {
  /** Full function path: "0x1::module::function" */
  function: string;
  /** Type arguments for generic functions */
  typeArguments?: string[];
  /** Function arguments */
  arguments?: unknown[];
}

interface TransactionPayload {
  /** Full function path: "0x1::module::function" */
  function: string;
  /** Type arguments for generic functions */
  typeArguments?: string[];
  /** Function arguments */
  arguments?: unknown[];
  /** Max gas (capped at 100000 for safety) */
  maxGasAmount?: number;
}

interface TransactionResult {
  hash: string;
  success: boolean;
  vmStatus: string;
  gasUsed: string;
  sender: string;
}

interface BalanceInfo {
  balance: string;
  coinType: string;
}

interface AccountInfo {
  exists: boolean;
  sequenceNumber: string;
  authenticationKey: string | null;
}

interface LedgerInfo {
  chainId: number;
  epoch: string;
  blockHeight: string;
  ledgerVersion: string;
  ledgerTimestamp: string;
  nodeRole: string;
}

// ============================================================================
// MOVEMENT HELPERS
// ============================================================================

interface MovementHelpers {
  /** Parse coin type string into components */
  parseCoinType(coinType: string): { address: string; module: string; struct: string } | null;
  /** Format raw amount with decimals (e.g., "1000000000" with 8 decimals -> "10.0") */
  formatAmount(amount: string, decimals?: number): string;
  /** Parse human amount to raw units (e.g., "10.5" with 8 decimals -> "1050000000") */
  parseAmount(amount: string, decimals?: number): string;
  /** Truncate address for display (e.g., "0x1234...cdef") */
  truncateAddress(address: string, start?: number, end?: number): string;

  /** Common coin types on Movement Network */
  coins: {
    /** Native MOVE token (Coin standard): 0x1::aptos_coin::AptosCoin */
    MOVE: string;
    /** MOVE as Fungible Asset */
    MOVE_FA: string;
    /** LayerZero bridged USDC */
    USDC: string;
    /** LayerZero bridged USDT */
    USDT: string;
    /** LayerZero bridged WETH */
    WETH: string;
    /** LayerZero bridged WBTC */
    WBTC: string;
    /** Alias for WETH */
    ETH: string;
  };

  /** Common protocol addresses */
  protocols: {
    /** Echelon Lending Protocol */
    ECHELON: string;
    /** LayerZero OFT Bridge */
    LAYERZERO_BRIDGE: string;
  };

  /** Token decimals reference */
  decimals: {
    MOVE: 8;
    USDC: 6;
    USDT: 6;
    WETH: 8;
    WBTC: 8;
  };

  /** DEX helper functions for AMM calculations */
  dex: {
    /** Calculate output amount for constant product AMM (x * y = k) */
    getAmountOut(amountIn: string, reserveIn: string, reserveOut: string, feeBps?: number): string;
    /** Calculate input amount needed for desired output */
    getAmountIn(amountOut: string, reserveIn: string, reserveOut: string, feeBps?: number): string;
    /** Calculate price impact percentage */
    getPriceImpact(amountIn: string, reserveIn: string, reserveOut: string): string;
  };

  /** Time utilities */
  time: {
    /** Current timestamp in milliseconds */
    now(): number;
    /** Current timestamp in seconds */
    nowSeconds(): number;
    /** Format timestamp as ISO string */
    formatTimestamp(timestamp: number): string;
    /** Timestamp N seconds ago */
    secondsAgo(seconds: number): number;
    /** Timestamp N minutes ago */
    minutesAgo(minutes: number): number;
    /** Timestamp N hours ago */
    hoursAgo(hours: number): number;
  };
}

// ============================================================================
// KEY-VALUE STORAGE
// ============================================================================

interface KVStorage {
  /** Store a value (30 day TTL, automatically serializes objects) */
  set(key: string, value: unknown): Promise<boolean>;
  /** Get a stored value (automatically deserializes JSON) */
  get<T = unknown>(key: string): Promise<T | null>;
  /** Delete a stored value */
  delete(key: string): Promise<boolean>;
  /** List all keys for this action */
  list(): Promise<string[]>;
}

// ============================================================================
// GLOBAL APIS
// ============================================================================

/** Fetch API (HTTPS only in production) */
declare function fetch(url: string, options?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers: Map<string, string>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}>;

/** Console API - logs are captured in execution results */
declare const console: {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
};

/** The ctx object is the main entry point for your action */
declare const ctx: ActionContext;
`;

export function ActionEditor({
  value,
  onChange,
  height = '400px',
  readOnly = false,
  onValidate,
}: ActionEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Configure TypeScript compiler options
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        strict: false,
        skipLibCheck: true,
        lib: ['es2020'],
      });

      // Add custom type definitions for the action context
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        ACTION_CONTEXT_TYPES,
        'file:///action-context.d.ts'
      );

      // Configure editor diagnostics
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // Handle validation markers
      if (onValidate) {
        monaco.editor.onDidChangeMarkers((uris: readonly Uri[]) => {
          const editorUri = editor.getModel()?.uri;
          if (editorUri && uris.some((uri) => uri.toString() === editorUri.toString())) {
            const markers = monaco.editor.getModelMarkers({ resource: editorUri });
            onValidate(markers);
          }
        });
      }

      // Format on paste
      editor.onDidPaste(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      });
    },
    [onValidate]
  );

  const handleChange: OnChange = useCallback(
    (newValue) => {
      onChange(newValue || '');
    },
    [onChange]
  );

  return (
    <div className="rounded-lg overflow-hidden border border-dark-700">
      <div className="bg-dark-800 px-4 py-2 border-b border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-dark-400">handler.ts</span>
          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
            TypeScript
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              editorRef.current?.getAction('editor.action.formatDocument')?.run();
            }}
            className="text-xs text-dark-400 hover:text-dark-300 transition-colors"
          >
            Format
          </button>
        </div>
      </div>
      <Editor
        height={height}
        defaultLanguage="typescript"
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          readOnly,
          wordWrap: 'on',
          folding: true,
          renderLineHighlight: 'line',
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          snippetSuggestions: 'top',
          padding: { top: 12, bottom: 12 },
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-dark-900">
            <div className="text-dark-400 text-sm">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}
