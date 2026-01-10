'use client';

import { useState } from 'react';
import Link from 'next/link';

type TabId = 'overview' | 'simulate' | 'guardian';

const CODE_EXAMPLES = {
  simulate: `// Simulate a transaction before execution
const response = await fetch('https://api.movewatch.xyz/v1/simulate/agent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Payment': signedPaymentTransaction, // Signed MOVE transfer
  },
  body: JSON.stringify({
    network: 'mainnet',
    functionName: '0x1::coin::transfer',
    typeArguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [recipientAddress, amount],
    sender: agentWalletAddress,
  }),
});

const result = await response.json();
// result._meta.endpoint === 'agent'
// result._meta.payment === 'x402'
console.log('Simulation success:', result.success);
console.log('Gas used:', result.gasUsed);`,

  guardian: `// Security scan before executing a DeFi trade
const response = await fetch('https://api.movewatch.xyz/v1/guardian/check/agent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Payment': signedPaymentTransaction, // Signed MOVE transfer
  },
  body: JSON.stringify({
    network: 'mainnet',
    functionName: '0xdex::router::swap_exact_input',
    typeArguments: ['0x1::aptos_coin::AptosCoin', '0xusdc::coin::USDC'],
    arguments: [amountIn, minAmountOut, deadline],
    sender: agentWalletAddress,
  }),
});

const result = await response.json();
// Check the AI recommendation
if (result._meta.recommendation === 'DO_NOT_EXECUTE') {
  console.error('Security risk detected:', result.riskScore);
  return; // Abort trade
}

if (result._meta.recommendation === 'PROCEED_WITH_CAUTION') {
  console.warn('Medium risk:', result.warnings);
}

// Safe to execute
executeTransaction();`,

  payment: `// Handling x402 Payment Required response
async function callAgentEndpoint(endpoint: string, body: object) {
  // First attempt - may return 402
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.status === 402) {
    // Parse payment requirements from response
    const { payment } = await response.json();

    // payment = {
    //   version: '1.0',
    //   network: 'movement-mainnet',
    //   payTo: '0x...movewatch_address',
    //   asset: 'MOVE',
    //   amount: '100000',           // 0.001 MOVE in octas
    //   amountFormatted: '0.001 MOVE',
    //   resource: 'POST /v1/simulate/agent',
    //   validUntil: '2024-01-01T00:05:00Z',
    // }

    // Sign the payment transaction
    const signedTx = await agentWallet.signTransaction({
      function: '0x1::coin::transfer',
      type_arguments: ['0x1::aptos_coin::AptosCoin'],
      arguments: [payment.payTo, payment.amount],
    });

    // Retry with payment header
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': btoa(JSON.stringify(signedTx)),
      },
      body: JSON.stringify(body),
    });
  }

  // Check for payment confirmation in response headers
  const paymentResponse = response.headers.get('X-Payment-Response');
  if (paymentResponse) {
    const { transactionHash, status } = JSON.parse(paymentResponse);
    console.log('Payment confirmed:', transactionHash);
  }

  return response.json();
}`,
};

export default function AgentAPIPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <main className="min-h-screen bg-dark-900">
      {/* Hero section */}
      <div className="bg-gradient-to-b from-primary-900/20 via-dark-900 to-dark-900 border-b border-dark-800">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-primary-400 text-sm mb-4">
              <span>For Autonomous Agents</span>
              <span className="text-xs bg-primary-500/20 px-1.5 py-0.5 rounded font-mono">x402</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Agent{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-teal-300">
                API
              </span>
            </h1>
            <p className="text-lg text-dark-400">
              Pay-per-use API endpoints for AI trading agents.
              <br className="hidden md:block" />
              Simulate transactions and detect exploits before execution.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-dark-700 mb-8">
          <nav className="flex gap-1">
            {[
              { id: 'overview' as const, label: 'Overview', icon: '📋' },
              { id: 'simulate' as const, label: 'Simulate Endpoint', icon: '⚡' },
              { id: 'guardian' as const, label: 'Guardian Endpoint', icon: '🛡️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-400'
                    : 'border-transparent text-dark-400 hover:text-dark-300 hover:border-dark-600'
                  }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Why Agents Need This */}
            <section className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Why AI Agents Need This</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-dark-100">Avoid Failed Transactions</h3>
                  <p className="text-sm text-dark-400">
                    Simulate transactions before execution to catch errors, insufficient balances, or unexpected slippage.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-dark-100">Detect Exploits & Rug Pulls</h3>
                  <p className="text-sm text-dark-400">
                    AI-powered security scanning detects malicious contracts, rug pulls, and known exploit patterns.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-dark-100">Pay Only For What You Use</h3>
                  <p className="text-sm text-dark-400">
                    No subscriptions or API keys. Pay per request with MOVE tokens using the x402 protocol.
                  </p>
                </div>
              </div>
            </section>

            {/* Available Endpoints */}
            <section className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Available Endpoints</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-lg border border-dark-700">
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-1 text-xs font-mono bg-green-500/20 text-green-400 rounded">POST</span>
                    <code className="text-sm text-dark-200">/v1/simulate/agent</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-dark-400">Transaction simulation</span>
                    <span className="px-2 py-1 text-xs font-medium bg-primary-500/20 text-primary-400 rounded">
                      0.001 MOVE
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-lg border border-dark-700">
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-1 text-xs font-mono bg-green-500/20 text-green-400 rounded">POST</span>
                    <code className="text-sm text-dark-200">/v1/guardian/check/agent</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-dark-400">Security analysis</span>
                    <span className="px-2 py-1 text-xs font-medium bg-primary-500/20 text-primary-400 rounded">
                      0.005 MOVE
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* How x402 Works */}
            <section className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">How x402 Payment Works</h2>
              <p className="text-dark-400 mb-6">
                x402 is an HTTP payment protocol that enables pay-per-request APIs without API keys or subscriptions.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-dark-100">Request Endpoint</h4>
                      <p className="text-sm text-dark-400">Agent sends a request to the API endpoint without payment.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium text-dark-100">Receive 402 Response</h4>
                      <p className="text-sm text-dark-400">Server returns HTTP 402 with payment requirements in X-Payment-Required header.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium text-dark-100">Sign Payment</h4>
                      <p className="text-sm text-dark-400">Agent signs a MOVE transfer transaction to the MoveWatch payment address.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold shrink-0">
                      4
                    </div>
                    <div>
                      <h4 className="font-medium text-dark-100">Retry with Payment</h4>
                      <p className="text-sm text-dark-400">Agent retries the request with signed transaction in X-Payment header.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold shrink-0">
                      5
                    </div>
                    <div>
                      <h4 className="font-medium text-dark-100">Payment Settled</h4>
                      <p className="text-sm text-dark-400">Server verifies signature and submits payment transaction on-chain.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-sm font-bold shrink-0">
                      6
                    </div>
                    <div>
                      <h4 className="font-medium text-dark-100">Receive Response</h4>
                      <p className="text-sm text-dark-400">API processes request and returns result with payment confirmation.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Code Example */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-dark-300">Example: Handling x402 Payment Flow</span>
                  <button
                    onClick={() => copyToClipboard(CODE_EXAMPLES.payment, 'payment')}
                    className="text-xs text-dark-400 hover:text-dark-300 flex items-center gap-1"
                  >
                    {copiedCode === 'payment' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-dark-900 rounded-lg p-4 overflow-x-auto text-sm">
                  <code className="text-dark-300">{CODE_EXAMPLES.payment}</code>
                </pre>
              </div>
            </section>

            {/* Key Benefits */}
            <section className="grid md:grid-cols-2 gap-6">
              <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
                <h3 className="font-semibold text-white mb-3">No API Keys Required</h3>
                <p className="text-sm text-dark-400">
                  Agent endpoints use x402 micropayments instead of traditional API keys. Your agent&apos;s wallet address is your identity.
                </p>
              </div>
              <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
                <h3 className="font-semibold text-white mb-3">No Rate Limits</h3>
                <p className="text-sm text-dark-400">
                  Pay-per-use model means no rate limits. Your agent can make as many requests as needed, paying only for what it uses.
                </p>
              </div>
              <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
                <h3 className="font-semibold text-white mb-3">Instant Settlement</h3>
                <p className="text-sm text-dark-400">
                  Payments are settled on Movement Network in real-time. Transaction hash returned in response headers.
                </p>
              </div>
              <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
                <h3 className="font-semibold text-white mb-3">Machine-Readable Responses</h3>
                <p className="text-sm text-dark-400">
                  All responses include <code className="text-primary-400">_meta</code> field with structured data for easy agent consumption.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* Simulate Tab */}
        {activeTab === 'simulate' && (
          <div className="space-y-8">
            <section className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2 py-1 text-xs font-mono bg-green-500/20 text-green-400 rounded">POST</span>
                <code className="text-lg text-dark-200">/v1/simulate/agent</code>
                <span className="px-2 py-1 text-xs font-medium bg-primary-500/20 text-primary-400 rounded">
                  0.001 MOVE
                </span>
              </div>
              <p className="text-dark-400 mb-6">
                Simulate a transaction before execution to verify expected outcomes, check gas costs, and avoid failed transactions.
              </p>

              <h3 className="font-medium text-dark-100 mb-3">Request Body</h3>
              <div className="bg-dark-900 rounded-lg p-4 mb-6 overflow-x-auto">
                <pre className="text-sm text-dark-300">{`{
  "network": "mainnet" | "testnet",
  "functionName": "0x1::module::function",
  "typeArguments": ["0x1::type::Type"],
  "arguments": [arg1, arg2, ...],
  "sender": "0x..." // Agent wallet address
}`}</pre>
              </div>

              <h3 className="font-medium text-dark-100 mb-3">Response</h3>
              <div className="bg-dark-900 rounded-lg p-4 mb-6 overflow-x-auto">
                <pre className="text-sm text-dark-300">{`{
  "success": true,
  "gasUsed": 1500,
  "gasUnitPrice": 100,
  "changes": [...],      // State changes
  "events": [...],       // Emitted events
  "_meta": {
    "endpoint": "agent",
    "payment": "x402",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}`}</pre>
              </div>

              <h3 className="font-medium text-dark-100 mb-3">Example Usage</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-dark-400">TypeScript</span>
                <button
                  onClick={() => copyToClipboard(CODE_EXAMPLES.simulate, 'simulate')}
                  className="text-xs text-dark-400 hover:text-dark-300 flex items-center gap-1"
                >
                  {copiedCode === 'simulate' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-dark-900 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-dark-300">{CODE_EXAMPLES.simulate}</code>
              </pre>
            </section>

            <section className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <h3 className="font-medium text-white mb-3">Use Cases</h3>
              <ul className="space-y-2 text-sm text-dark-400">
                <li className="flex items-start gap-2">
                  <span className="text-primary-400">•</span>
                  Verify token swaps will succeed with expected output amounts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400">•</span>
                  Check gas costs before executing large batch transactions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400">•</span>
                  Validate liquidity operations won&apos;t fail due to slippage
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400">•</span>
                  Test complex multi-step DeFi strategies before execution
                </li>
              </ul>
            </section>
          </div>
        )}

        {/* Guardian Tab */}
        {activeTab === 'guardian' && (
          <div className="space-y-8">
            <section className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2 py-1 text-xs font-mono bg-green-500/20 text-green-400 rounded">POST</span>
                <code className="text-lg text-dark-200">/v1/guardian/check/agent</code>
                <span className="px-2 py-1 text-xs font-medium bg-primary-500/20 text-primary-400 rounded">
                  0.005 MOVE
                </span>
              </div>
              <p className="text-dark-400 mb-6">
                AI-powered security analysis to detect exploits, rug pulls, and malicious contracts before your agent interacts with them.
              </p>

              <h3 className="font-medium text-dark-100 mb-3">Request Body</h3>
              <div className="bg-dark-900 rounded-lg p-4 mb-6 overflow-x-auto">
                <pre className="text-sm text-dark-300">{`{
  "network": "mainnet" | "testnet",
  "functionName": "0x1::module::function",
  "typeArguments": ["0x1::type::Type"],
  "arguments": [arg1, arg2, ...],
  "sender": "0x..." // Agent wallet address (optional)
}`}</pre>
              </div>

              <h3 className="font-medium text-dark-100 mb-3">Response</h3>
              <div className="bg-dark-900 rounded-lg p-4 mb-6 overflow-x-auto">
                <pre className="text-sm text-dark-300">{`{
  "riskScore": 25,          // 0-100, higher = more risky
  "riskLevel": "low",       // low | medium | high | critical
  "warnings": [...],        // Detected issues
  "analysis": {
    "patterns": [...],      // Matched risk patterns
    "aiInsights": "...",    // AI analysis summary
  },
  "_meta": {
    "endpoint": "agent",
    "payment": "x402",
    "timestamp": "2024-01-01T00:00:00Z",
    "recommendation": "SAFE_TO_EXECUTE" | "PROCEED_WITH_CAUTION" | "DO_NOT_EXECUTE"
  }
}`}</pre>
              </div>

              <h3 className="font-medium text-dark-100 mb-3">Recommendation Values</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="font-mono text-sm text-green-400 mb-1">SAFE_TO_EXECUTE</div>
                  <div className="text-xs text-dark-400">Risk score &lt; 40</div>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="font-mono text-sm text-yellow-400 mb-1">PROCEED_WITH_CAUTION</div>
                  <div className="text-xs text-dark-400">Risk score 40-69</div>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                  <div className="font-mono text-sm text-red-400 mb-1">DO_NOT_EXECUTE</div>
                  <div className="text-xs text-dark-400">Risk score &ge; 70</div>
                </div>
              </div>

              <h3 className="font-medium text-dark-100 mb-3">Example Usage</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-dark-400">TypeScript</span>
                <button
                  onClick={() => copyToClipboard(CODE_EXAMPLES.guardian, 'guardian')}
                  className="text-xs text-dark-400 hover:text-dark-300 flex items-center gap-1"
                >
                  {copiedCode === 'guardian' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-dark-900 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-dark-300">{CODE_EXAMPLES.guardian}</code>
              </pre>
            </section>

            <section className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <h3 className="font-medium text-white mb-3">What Guardian Detects</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="space-y-2 text-sm text-dark-400">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Rug pull patterns and honeypot contracts
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Known exploit signatures (flash loans, reentrancy)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    Suspicious admin functions and privileged operations
                  </li>
                </ul>
                <ul className="space-y-2 text-sm text-dark-400">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">•</span>
                    Unverified or newly deployed contracts
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">•</span>
                    Addresses linked to known scams
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-400">•</span>
                    Unusual token economics or fee structures
                  </li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {/* CTA Section */}
        <section className="mt-12 text-center">
          <div className="bg-gradient-to-r from-primary-900/30 to-teal-900/30 rounded-xl border border-primary-500/30 p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Ready to integrate?</h2>
            <p className="text-dark-400 mb-6">
              Try the endpoints manually first using our interactive tools.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/simulator"
                className="px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Try Simulator
              </Link>
              <Link
                href="/guardian"
                className="px-6 py-3 bg-dark-700 text-white rounded-lg font-medium hover:bg-dark-600 transition-colors border border-dark-600"
              >
                Try Guardian
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
