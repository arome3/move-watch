/**
 * CLI Executor Service
 * Runs Aptos CLI commands for detailed gas profiling and execution traces
 *
 * This provides REAL execution traces from the Move VM, including:
 * - Per-instruction gas costs
 * - Full call stack with gas at each level
 * - Flamegraph data for visualization
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { Network } from '@movewatch/shared';
import { NETWORK_CONFIGS } from '@movewatch/shared';

export interface CLISimulationRequest {
  network: Network;
  sender: string;
  privateKey?: string; // Private key for signing (hex format)
  functionId: string; // e.g., "0x1::coin::transfer"
  typeArguments?: string[];
  arguments?: string[];
  maxGasAmount?: number;
  gasUnitPrice?: number;
}

export interface CLIExecutionTrace {
  operations: CLITraceOperation[];
  totalGas: number;
  executionGas: number;
  ioGas: number;
  storageGas: number;
  storageFee: number; // in APT
}

export interface CLITraceOperation {
  depth: number;
  operation: string;
  module?: string;
  function?: string;
  gasUsed: number;
  percentage: number;
  children?: CLITraceOperation[];
}

export interface CLIGasBreakdown {
  intrinsic: number;
  execution: number;
  io: number;
  storage: number;
  storageRefund: number;
  total: number;
  byCategory: Record<string, number>;
}

export interface CLISimulationResult {
  success: boolean;
  gasUsed: number;
  vmStatus: string;
  executionTrace?: CLIExecutionTrace;
  gasBreakdown?: CLIGasBreakdown;
  flamegraphData?: string; // SVG or HTML content
  rawOutput?: string;
  error?: string;
}

/**
 * Check if Aptos CLI is installed
 */
export async function checkCliInstalled(): Promise<{ installed: boolean; version?: string; path?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('aptos', ['--version'], { shell: true });
    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const versionMatch = output.match(/aptos (\d+\.\d+\.\d+)/);
        resolve({
          installed: true,
          version: versionMatch?.[1] || 'unknown',
          path: 'aptos', // Could use 'which aptos' to get full path
        });
      } else {
        resolve({ installed: false });
      }
    });

    proc.on('error', () => {
      resolve({ installed: false });
    });
  });
}

/**
 * Run a simulation with gas profiling using the Aptos CLI
 */
export async function runCLISimulation(request: CLISimulationRequest): Promise<CLISimulationResult> {
  // Create a temporary directory for the simulation
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'movewatch-sim-'));

  try {
    const networkConfig = NETWORK_CONFIGS[request.network];

    // Build the CLI command arguments
    const args = [
      'move', 'run',
      '--function-id', request.functionId,
      '--profile-gas',
      '--assume-yes', // Don't prompt for confirmation
      '--url', networkConfig.fullnode,
    ];

    // Add sender and private key if specified
    if (request.sender) {
      args.push('--sender-account', request.sender);
    }

    // Add private key for signing (required for CLI to work without config)
    if (request.privateKey) {
      args.push('--private-key', request.privateKey);
    }

    // Add type arguments
    if (request.typeArguments && request.typeArguments.length > 0) {
      for (const typeArg of request.typeArguments) {
        args.push('--type-args', typeArg);
      }
    }

    // Add function arguments
    if (request.arguments && request.arguments.length > 0) {
      for (const arg of request.arguments) {
        args.push('--args', arg);
      }
    }

    // Add gas settings
    if (request.maxGasAmount) {
      args.push('--max-gas', request.maxGasAmount.toString());
    }
    if (request.gasUnitPrice) {
      args.push('--gas-unit-price', request.gasUnitPrice.toString());
    }

    // Log the command for debugging
    console.log('[CLI] Running command: aptos', args.join(' '));
    console.log('[CLI] Working directory:', tempDir);

    // Run the CLI command
    const result = await executeCommand('aptos', args, {
      cwd: tempDir,
      timeout: 60000, // 60 second timeout
    });

    // Log result for debugging
    console.log('[CLI] Command result:', { success: result.success, stdout: result.stdout?.slice(0, 500), stderr: result.stderr?.slice(0, 500) });

    if (!result.success) {
      return {
        success: false,
        gasUsed: 0,
        vmStatus: 'CLI_ERROR',
        error: result.stderr || result.error || 'CLI execution failed',
        rawOutput: result.stdout,
      };
    }

    // Parse the CLI output
    const parsedResult = parseCLIOutput(result.stdout);

    // Try to find and parse the gas profile report
    const gasProfileDir = path.join(tempDir, 'gas-profiling');
    let executionTrace: CLIExecutionTrace | undefined;
    let gasBreakdown: CLIGasBreakdown | undefined;
    let flamegraphData: string | undefined;

    try {
      const profileDirs = await fs.readdir(gasProfileDir);
      if (profileDirs.length > 0) {
        const latestProfile = path.join(gasProfileDir, profileDirs[0]);

        // Parse execution trace from the generated files
        const traceResult = await parseGasProfileReport(latestProfile);
        executionTrace = traceResult.executionTrace;
        gasBreakdown = traceResult.gasBreakdown;
        flamegraphData = traceResult.flamegraphHtml;
      }
    } catch {
      // Gas profile directory may not exist if simulation failed early
    }

    return {
      success: parsedResult.success,
      gasUsed: parsedResult.gasUsed,
      vmStatus: parsedResult.vmStatus,
      executionTrace,
      gasBreakdown,
      flamegraphData,
      rawOutput: result.stdout,
    };
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Execute a command and return the result
 */
function executeCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeout: number }
): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      shell: true,
      timeout: options.timeout,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        stdout,
        stderr,
        error: err.message,
      });
    });
  });
}

/**
 * Parse the CLI stdout to extract basic simulation results
 */
function parseCLIOutput(output: string): { success: boolean; gasUsed: number; vmStatus: string } {
  // The CLI outputs JSON for transaction results wrapped in a "Result" key
  // Example: { "Result": { "transaction_hash": "...", "gas_used": 203, "success": true, "vm_status": "..." } }
  try {
    // Look for JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*"Result"[\s\S]*"gas_used"[\s\S]*\}/);
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      // The actual result is nested inside "Result"
      const result = json.Result || json;
      return {
        success: result.success === true || result.vm_status?.includes('EXECUTED'),
        gasUsed: parseInt(result.gas_used || '0', 10),
        vmStatus: result.vm_status || 'unknown',
      };
    }
  } catch {
    // JSON parsing failed
  }

  // Fallback: try to extract from text output
  const gasMatch = output.match(/gas_used["\s:]+(\d+)/i);
  const successMatch = output.match(/success["\s:]+(\w+)/i);
  const vmStatusMatch = output.match(/vm_status["\s:]+["']?([^"'\n,}]+)/i);

  return {
    success: successMatch?.[1]?.toLowerCase() === 'true',
    gasUsed: gasMatch ? parseInt(gasMatch[1], 10) : 0,
    vmStatus: vmStatusMatch?.[1] || 'unknown',
  };
}

/**
 * Parse the gas profile report generated by --profile-gas
 */
async function parseGasProfileReport(profileDir: string): Promise<{
  executionTrace?: CLIExecutionTrace;
  gasBreakdown?: CLIGasBreakdown;
  flamegraphHtml?: string;
}> {
  const result: {
    executionTrace?: CLIExecutionTrace;
    gasBreakdown?: CLIGasBreakdown;
    flamegraphHtml?: string;
  } = {};

  try {
    // Read the index.html file which contains the full report
    const indexPath = path.join(profileDir, 'index.html');
    const indexHtml = await fs.readFile(indexPath, 'utf-8');

    // Store the flamegraph HTML for frontend rendering
    result.flamegraphHtml = indexHtml;

    // Extract execution trace from the HTML
    // The trace is typically in a <pre> or <code> block with specific formatting
    result.executionTrace = extractExecutionTrace(indexHtml);

    // Extract gas breakdown
    result.gasBreakdown = extractGasBreakdown(indexHtml);
  } catch {
    // Profile files may not exist or be readable
  }

  return result;
}

/**
 * Extract execution trace from the gas profile HTML
 */
function extractExecutionTrace(html: string): CLIExecutionTrace | undefined {
  // The execution trace in the CLI output looks like:
  // ```
  // call 0x1::coin::transfer<0x1::aptos_coin::AptosCoin>
  //     intrinsic                                           1,278 (0.94%)
  //     call 0x1::coin::withdraw<0x1::aptos_coin::AptosCoin>
  //         load 0x1::coin                                    102 (0.08%)
  //         ...
  // ```

  const operations: CLITraceOperation[] = [];
  let totalGas = 0;
  let executionGas = 0;
  let ioGas = 0;
  let storageGas = 0;
  let storageFee = 0;

  // Look for the execution trace section
  const traceMatch = html.match(/Execution\s*(?:&amp;|&)?\s*IO[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!traceMatch) {
    return undefined;
  }

  const traceText = traceMatch[1]
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

  const lines = traceText.split('\n');
  const stack: { depth: number; op: CLITraceOperation }[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Count leading spaces to determine depth
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
    const depth = Math.floor(leadingSpaces / 4);

    // Parse the operation line
    // Format: "operation_name                    gas_amount (percentage%)"
    const opMatch = line.trim().match(/^(\S+(?:\s+\S+)*?)\s+(\d[\d,]*)\s*\((\d+\.?\d*)%\)/);
    if (!opMatch) continue;

    const [, operationName, gasStr, percentStr] = opMatch;
    const gasUsed = parseInt(gasStr.replace(/,/g, ''), 10);
    const percentage = parseFloat(percentStr);

    // Parse module::function from operation name
    let module: string | undefined;
    let func: string | undefined;
    const funcMatch = operationName.match(/(?:call\s+)?(\S+)::(\S+)(?:<.*>)?/);
    if (funcMatch) {
      module = funcMatch[1];
      func = funcMatch[2];
    }

    const op: CLITraceOperation = {
      depth,
      operation: operationName,
      module,
      function: func,
      gasUsed,
      percentage,
      children: [],
    };

    totalGas += gasUsed;

    // Categorize gas
    if (operationName.includes('load') || operationName.includes('read')) {
      ioGas += gasUsed;
    } else if (operationName.includes('write') || operationName.includes('store')) {
      storageGas += gasUsed;
    } else {
      executionGas += gasUsed;
    }

    // Build tree structure
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].op.children?.push(op);
    } else {
      operations.push(op);
    }

    stack.push({ depth, op });
  }

  // Extract storage fee if present
  const storageFeeMatch = html.match(/storage[^:]*:\s*([\d.]+)\s*APT/i);
  if (storageFeeMatch) {
    storageFee = parseFloat(storageFeeMatch[1]);
  }

  return {
    operations,
    totalGas,
    executionGas,
    ioGas,
    storageGas,
    storageFee,
  };
}

/**
 * Extract gas breakdown from the gas profile HTML
 */
function extractGasBreakdown(html: string): CLIGasBreakdown | undefined {
  const breakdown: CLIGasBreakdown = {
    intrinsic: 0,
    execution: 0,
    io: 0,
    storage: 0,
    storageRefund: 0,
    total: 0,
    byCategory: {},
  };

  // Look for the cost breakdown table
  // Categories typically include: intrinsic, execution, io, storage, storage_refund

  const intrinsicMatch = html.match(/intrinsic[^:]*:\s*([\d,]+)/i);
  const executionMatch = html.match(/execution[^:]*:\s*([\d,]+)/i);
  const ioMatch = html.match(/io[^:]*:\s*([\d,]+)/i);
  const storageMatch = html.match(/storage(?!\s*refund)[^:]*:\s*([\d,]+)/i);
  const refundMatch = html.match(/storage[\s_]*refund[^:]*:\s*([\d,]+)/i);
  const totalMatch = html.match(/total[^:]*:\s*([\d,]+)/i);

  if (intrinsicMatch) breakdown.intrinsic = parseInt(intrinsicMatch[1].replace(/,/g, ''), 10);
  if (executionMatch) breakdown.execution = parseInt(executionMatch[1].replace(/,/g, ''), 10);
  if (ioMatch) breakdown.io = parseInt(ioMatch[1].replace(/,/g, ''), 10);
  if (storageMatch) breakdown.storage = parseInt(storageMatch[1].replace(/,/g, ''), 10);
  if (refundMatch) breakdown.storageRefund = parseInt(refundMatch[1].replace(/,/g, ''), 10);
  if (totalMatch) breakdown.total = parseInt(totalMatch[1].replace(/,/g, ''), 10);

  breakdown.byCategory = {
    intrinsic: breakdown.intrinsic,
    execution: breakdown.execution,
    io: breakdown.io,
    storage: breakdown.storage,
    storage_refund: breakdown.storageRefund,
  };

  // Only return if we found meaningful data
  if (breakdown.total > 0 || breakdown.execution > 0) {
    return breakdown;
  }

  return undefined;
}

/**
 * Format CLI trace operations for the frontend ExecutionStep format
 */
export function convertCLITraceToExecutionSteps(
  trace: CLIExecutionTrace
): Array<{
  index: number;
  type: string;
  module: string;
  function?: string;
  description: string;
  gasUsed: number;
  cumulativeGas: number;
  data?: unknown;
  children?: unknown[];
}> {
  const steps: Array<{
    index: number;
    type: string;
    module: string;
    function?: string;
    description: string;
    gasUsed: number;
    cumulativeGas: number;
    data?: unknown;
  }> = [];

  let cumulativeGas = 0;
  let index = 0;

  function processOperation(op: CLITraceOperation) {
    cumulativeGas += op.gasUsed;

    // Determine step type
    let type = 'FUNCTION_CALL';
    const opLower = op.operation.toLowerCase();
    if (opLower.includes('load') || opLower.includes('read')) {
      type = 'RESOURCE_READ';
    } else if (opLower.includes('write') || opLower.includes('store')) {
      type = 'RESOURCE_WRITE';
    } else if (opLower.includes('create')) {
      type = 'RESOURCE_CREATE';
    } else if (opLower.includes('delete') || opLower.includes('destroy')) {
      type = 'RESOURCE_DELETE';
    } else if (opLower.includes('emit') || opLower.includes('event')) {
      type = 'EVENT_EMIT';
    } else if (opLower.includes('abort')) {
      type = 'ABORT';
    } else if (opLower.includes('intrinsic')) {
      type = 'INTRINSIC';
    }

    steps.push({
      index: index++,
      type,
      module: op.module || 'vm',
      function: op.function,
      description: op.operation,
      gasUsed: op.gasUsed,
      cumulativeGas,
      data: {
        percentage: op.percentage,
        depth: op.depth,
      },
    });

    // Process children recursively
    if (op.children) {
      for (const child of op.children) {
        processOperation(child);
      }
    }
  }

  for (const op of trace.operations) {
    processOperation(op);
  }

  return steps;
}
