'use client';

import { useState } from 'react';

interface SecurityEducationProps {
  variant?: 'inline' | 'modal' | 'banner';
  showByDefault?: boolean;
}

/**
 * SecurityEducation Component
 *
 * Provides critical security education to users about:
 * - What this tool can and cannot detect
 * - Best practices for transaction safety
 * - How to properly verify transactions
 * - What real security looks like
 *
 * This is essential because automated tools can create false confidence.
 */
export function SecurityEducation({ variant = 'banner', showByDefault = false }: SecurityEducationProps) {
  const [expanded, setExpanded] = useState(showByDefault);

  if (variant === 'banner' && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full p-3 bg-dark-700/50 hover:bg-dark-700 border border-dark-600 rounded-lg transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-dark-200">
              Important: Understanding Security Analysis Limitations
            </span>
            <span className="text-xs text-dark-400 ml-2">Click to learn more</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-dark-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-dark-100">Security Analysis Limitations</h3>
            <p className="text-sm text-dark-400">What you need to know before signing</p>
          </div>
        </div>
        {variant === 'banner' && (
          <button
            onClick={() => setExpanded(false)}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-dark-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* What We Do */}
        <section>
          <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            What This Tool Does
          </h4>
          <ul className="text-sm text-dark-300 space-y-1.5 pl-6">
            <li className="list-disc">Verifies modules and functions exist on-chain</li>
            <li className="list-disc">Detects known malicious patterns and addresses</li>
            <li className="list-disc">Analyzes actual token flows and state changes</li>
            <li className="list-disc">Flags suspicious event sequences</li>
            <li className="list-disc">Checks for known exploit patterns</li>
          </ul>
        </section>

        {/* What We Cannot Do */}
        <section>
          <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            What This Tool CANNOT Do
          </h4>
          <ul className="text-sm text-dark-300 space-y-1.5 pl-6">
            <li className="list-disc">Guarantee a transaction is safe (no tool can)</li>
            <li className="list-disc">Detect novel/unknown exploit types</li>
            <li className="list-disc">Understand business logic vulnerabilities</li>
            <li className="list-disc">Protect against social engineering</li>
            <li className="list-disc">Verify the legitimacy of project teams</li>
            <li className="list-disc">Detect time-delayed attacks or governance exploits</li>
          </ul>
        </section>

        {/* Real Security */}
        <section className="bg-dark-700/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-400 mb-2">
            What Real Security Looks Like
          </h4>
          <div className="text-sm text-dark-300 space-y-3">
            <div className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">1.</span>
              <div>
                <span className="font-medium text-dark-200">Verify the contract address</span>
                <p className="text-xs text-dark-400 mt-0.5">
                  Always check official sources (project website, official Discord, verified social media) for the correct contract address.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">2.</span>
              <div>
                <span className="font-medium text-dark-200">Review audit reports</span>
                <p className="text-xs text-dark-400 mt-0.5">
                  Check if the project has been audited by reputable firms (MoveBit, OtterSec, Verichains). Read the findings.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">3.</span>
              <div>
                <span className="font-medium text-dark-200">Understand what you're signing</span>
                <p className="text-xs text-dark-400 mt-0.5">
                  Read the function name and parameters. If you don't understand what it does, don't sign it.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">4.</span>
              <div>
                <span className="font-medium text-dark-200">Use limited approvals</span>
                <p className="text-xs text-dark-400 mt-0.5">
                  Never approve unlimited token spending. Only approve the exact amount needed for the transaction.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">5.</span>
              <div>
                <span className="font-medium text-dark-200">Test with small amounts first</span>
                <p className="text-xs text-dark-400 mt-0.5">
                  When interacting with a new protocol, start with a small test transaction before committing large amounts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Warning */}
        <section className="border-l-4 border-yellow-500 pl-4 py-2">
          <p className="text-sm text-yellow-400 font-medium">
            A "safe" analysis result does NOT guarantee safety.
          </p>
          <p className="text-xs text-dark-400 mt-1">
            This tool is an additional layer of protection, not a replacement for due diligence.
            Sophisticated attacks can bypass automated detection. Always verify independently.
          </p>
        </section>

        {/* Resources */}
        <section>
          <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">
            Security Resources
          </h4>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://github.com/SunWeb3Sec/DeFiHackLabs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-full text-dark-300 hover:text-dark-100 transition-colors"
            >
              DeFi Hack Labs
            </a>
            <a
              href="https://rekt.news"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-full text-dark-300 hover:text-dark-100 transition-colors"
            >
              Rekt News
            </a>
            <a
              href="https://movebit.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-full text-dark-300 hover:text-dark-100 transition-colors"
            >
              MoveBit Security
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Compact disclaimer for showing below results
 */
export function SecurityDisclaimer() {
  return (
    <p className="text-xs text-dark-500 text-center mt-4 px-4">
      This analysis is provided for informational purposes only. No automated tool can guarantee
      transaction safety. Always verify contract addresses independently and exercise caution
      when signing transactions.
    </p>
  );
}

/**
 * Risk confidence explanation tooltip content
 */
export function ConfidenceExplanation() {
  return (
    <div className="max-w-xs p-3 text-xs">
      <h4 className="font-semibold text-dark-100 mb-2">Confidence Levels</h4>
      <div className="space-y-2 text-dark-300">
        <div>
          <span className="font-medium text-green-400">Very High (0.9+):</span> Verified on-chain or from scam database
        </div>
        <div>
          <span className="font-medium text-blue-400">High (0.7-0.9):</span> Strong pattern match with context
        </div>
        <div>
          <span className="font-medium text-yellow-400">Medium (0.5-0.7):</span> Pattern match, needs verification
        </div>
        <div>
          <span className="font-medium text-red-400">Low (&lt;0.5):</span> Weak signal, may be false positive
        </div>
      </div>
    </div>
  );
}
