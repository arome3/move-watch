/**
 * Diff Builder
 * Computes human-readable diffs between before/after state
 */
import type { StateChange, StateChangeDiff, FieldDiff } from '@movewatch/shared';

// Known resource field mappings for human-readable labels
const FIELD_LABELS: Record<string, Record<string, string>> = {
  'CoinStore': {
    'coin.value': 'Balance',
    'frozen': 'Frozen',
    'deposit_events.counter': 'Deposit Count',
    'withdraw_events.counter': 'Withdraw Count',
  },
  'Account': {
    'sequence_number': 'Sequence Number',
    'authentication_key': 'Auth Key',
    'guid_creation_num': 'GUID Counter',
  },
  'FungibleStore': {
    'balance': 'Balance',
    'frozen': 'Frozen',
  },
};

// Format octas to APT (8 decimals)
function formatOctas(octas: string | number | bigint): string {
  const value = BigInt(octas.toString());
  const apt = Number(value) / 100_000_000;
  if (apt >= 1000000) {
    return `${(apt / 1000000).toFixed(2)}M APT`;
  } else if (apt >= 1000) {
    return `${(apt / 1000).toFixed(2)}K APT`;
  } else if (apt >= 1) {
    return `${apt.toFixed(4)} APT`;
  } else {
    return `${value.toString()} octas`;
  }
}

// Format large numbers with commas
function formatNumber(value: string | number | bigint): string {
  const num = BigInt(value.toString());
  return num.toLocaleString('en-US');
}

// Truncate address for display
function formatAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

// Extract resource type name from full path
function getResourceTypeName(resource: string): string {
  // e.g., "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>" -> "CoinStore"
  const match = resource.match(/::(\w+)(?:<|$)/);
  return match?.[1] || 'Unknown';
}

// Get nested value from object by path
function getValueByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Check if value looks like octas (coin balance)
function isOctasValue(path: string, value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const lowerPath = path.toLowerCase();
  return lowerPath.includes('value') ||
         lowerPath.includes('balance') ||
         lowerPath.includes('amount') ||
         lowerPath.includes('octas');
}

// Format a value based on its type and path
function formatValue(path: string, value: unknown): string {
  if (value === null || value === undefined) return 'null';

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'string') {
    // Check if it's a hex address
    if (value.startsWith('0x') && value.length > 20) {
      return formatAddress(value);
    }
    // Check if it's a numeric string (could be octas)
    if (/^\d+$/.test(value)) {
      if (isOctasValue(path, value)) {
        return formatOctas(value);
      }
      return formatNumber(value);
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    if (isOctasValue(path, value)) {
      return formatOctas(value);
    }
    return formatNumber(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }

  if (typeof value === 'object') {
    return '{...}';
  }

  return String(value);
}

// Compute change string for numeric values
function computeChange(beforeVal: unknown, afterVal: unknown, path: string): string | undefined {
  // Only compute change for numeric values
  if (typeof beforeVal === 'string' && typeof afterVal === 'string' &&
      /^\d+$/.test(beforeVal) && /^\d+$/.test(afterVal)) {
    const before = BigInt(beforeVal);
    const after = BigInt(afterVal);
    const diff = after - before;

    if (diff === BigInt(0)) return undefined;

    const sign = diff > 0 ? '+' : '';
    if (isOctasValue(path, beforeVal)) {
      const apt = Number(diff) / 100_000_000;
      return `${sign}${apt.toFixed(4)} APT`;
    }
    return `${sign}${diff.toLocaleString('en-US')}`;
  }
  return undefined;
}

// Get important paths for a resource type
function getImportantPaths(resourceType: string): string[] {
  const paths: Record<string, string[]> = {
    'CoinStore': ['coin.value', 'frozen', 'deposit_events.counter', 'withdraw_events.counter'],
    'Account': ['sequence_number', 'authentication_key'],
    'FungibleStore': ['balance', 'frozen'],
    'Object': ['owner'],
  };
  return paths[resourceType] || [];
}

// Recursively find all leaf paths in an object
function findAllPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return prefix ? [prefix] : [];
  }

  if (Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }

  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...findAllPaths(value, newPrefix));
    } else {
      paths.push(newPrefix);
    }
  }
  return paths;
}

/**
 * Compute human-readable diff for a state change
 */
export function computeStateDiff(change: StateChange): StateChangeDiff {
  const resourceType = getResourceTypeName(change.resource);
  const labels = FIELD_LABELS[resourceType] || {};
  const fields: FieldDiff[] = [];

  // Get paths to compare
  const importantPaths = getImportantPaths(resourceType);
  const allBeforePaths = change.before ? findAllPaths(change.before) : [];
  const allAfterPaths = change.after ? findAllPaths(change.after) : [];

  // Combine and dedupe paths, prioritizing important ones
  const pathsToCheck = new Set([
    ...importantPaths,
    ...allBeforePaths.slice(0, 10),  // Limit to prevent huge diffs
    ...allAfterPaths.slice(0, 10),
  ]);

  // For create type, only show after values
  if (change.type === 'create') {
    for (const path of pathsToCheck) {
      const afterVal = getValueByPath(change.after, path);
      if (afterVal !== undefined) {
        fields.push({
          path,
          label: labels[path] || path.split('.').pop() || path,
          after: formatValue(path, afterVal),
          changeType: 'added',
        });
      }
    }

    return {
      summary: `Created ${resourceType} at ${formatAddress(change.address)}`,
      fields: fields.slice(0, 8),  // Limit fields shown
    };
  }

  // For delete type, only show before values
  if (change.type === 'delete') {
    for (const path of pathsToCheck) {
      const beforeVal = getValueByPath(change.before, path);
      if (beforeVal !== undefined) {
        fields.push({
          path,
          label: labels[path] || path.split('.').pop() || path,
          before: formatValue(path, beforeVal),
          changeType: 'removed',
        });
      }
    }

    return {
      summary: `Deleted ${resourceType} from ${formatAddress(change.address)}`,
      fields: fields.slice(0, 8),
    };
  }

  // For modify type, show before/after diff
  let summaryParts: string[] = [];

  for (const path of pathsToCheck) {
    const beforeVal = getValueByPath(change.before, path);
    const afterVal = getValueByPath(change.after, path);

    // Skip if both undefined
    if (beforeVal === undefined && afterVal === undefined) continue;

    const beforeFormatted = formatValue(path, beforeVal);
    const afterFormatted = formatValue(path, afterVal);

    // Determine change type
    let changeType: FieldDiff['changeType'];
    if (beforeVal === undefined) {
      changeType = 'added';
    } else if (afterVal === undefined) {
      changeType = 'removed';
    } else if (beforeFormatted === afterFormatted) {
      changeType = 'unchanged';
    } else {
      changeType = 'modified';
    }

    // Skip unchanged unless it's an important path
    if (changeType === 'unchanged' && !importantPaths.includes(path)) {
      continue;
    }

    const fieldDiff: FieldDiff = {
      path,
      label: labels[path] || path.split('.').pop() || path,
      before: beforeFormatted,
      after: afterFormatted,
      change: changeType === 'modified' ? computeChange(beforeVal, afterVal, path) : undefined,
      changeType,
    };

    fields.push(fieldDiff);

    // Build summary for important changes
    if (changeType === 'modified' && importantPaths.includes(path)) {
      const label = labels[path] || path.split('.').pop() || path;
      if (fieldDiff.change) {
        summaryParts.push(`${label}: ${beforeFormatted} → ${afterFormatted} (${fieldDiff.change})`);
      } else {
        summaryParts.push(`${label}: ${beforeFormatted} → ${afterFormatted}`);
      }
    }
  }

  // Generate summary
  let summary: string;
  if (summaryParts.length > 0) {
    summary = summaryParts.slice(0, 2).join(', ');
  } else if (fields.length > 0) {
    summary = `Modified ${resourceType} at ${formatAddress(change.address)}`;
  } else {
    summary = `${resourceType} unchanged`;
  }

  return {
    summary,
    fields: fields.slice(0, 8),  // Limit fields shown
  };
}

/**
 * Enhance state changes with computed diffs
 */
export function enhanceWithDiffs(changes: StateChange[]): StateChange[] {
  return changes.map(change => ({
    ...change,
    diff: computeStateDiff(change),
  }));
}
