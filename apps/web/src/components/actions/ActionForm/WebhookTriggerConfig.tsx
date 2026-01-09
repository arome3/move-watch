'use client';

import { useState, useEffect, useRef } from 'react';
import type { WebhookTriggerConfig as WebhookTriggerConfigType } from '@movewatch/shared';

interface WebhookTriggerConfigProps {
  value: WebhookTriggerConfigType | null;
  onChange: (config: WebhookTriggerConfigType) => void;
  actionId?: string; // If editing existing action
  errors?: Record<string, string>;
}

export function WebhookTriggerConfig({
  value,
  onChange,
  actionId,
  errors,
}: WebhookTriggerConfigProps) {
  const [webhookSecret, setWebhookSecret] = useState(value?.webhookSecret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [allowedIps, setAllowedIps] = useState<string[]>(value?.allowedIps || []);
  const [newIp, setNewIp] = useState('');
  const [requireHeaders, setRequireHeaders] = useState<Record<string, string>>(
    value?.requireHeaders || {}
  );
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');

  // Generate a random webhook secret
  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    setWebhookSecret(secret);
  };

  // Use ref to avoid infinite loops with onChange callback
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Update parent when config changes
  useEffect(() => {
    const config: WebhookTriggerConfigType = {
      type: 'webhook',
      ...(webhookSecret && { webhookSecret }),
      ...(allowedIps.length > 0 && { allowedIps }),
      ...(Object.keys(requireHeaders).length > 0 && { requireHeaders }),
    };
    onChangeRef.current(config);
  }, [webhookSecret, allowedIps, requireHeaders]);

  const addIp = () => {
    if (newIp && !allowedIps.includes(newIp)) {
      setAllowedIps([...allowedIps, newIp]);
      setNewIp('');
    }
  };

  const removeIp = (ip: string) => {
    setAllowedIps(allowedIps.filter((i) => i !== ip));
  };

  const addHeader = () => {
    if (newHeaderKey && newHeaderValue) {
      setRequireHeaders({ ...requireHeaders, [newHeaderKey]: newHeaderValue });
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    const updated = { ...requireHeaders };
    delete updated[key];
    setRequireHeaders(updated);
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const webhookUrl = actionId
    ? `${API_URL}/v1/actions/webhook/${actionId}`
    : `${API_URL}/v1/actions/webhook/<action-id>`;

  return (
    <div className="space-y-5">
      {/* Webhook URL Display */}
      <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-dark-300">Webhook URL</label>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(webhookUrl)}
            className="text-xs text-primary-400 hover:text-primary-300"
          >
            Copy
          </button>
        </div>
        <code className="block text-sm text-green-400 break-all font-mono bg-dark-900 p-2 rounded">
          {webhookUrl}
        </code>
        {!actionId && (
          <p className="text-xs text-dark-500 mt-2">
            The action ID will be available after saving
          </p>
        )}
      </div>

      {/* Webhook Secret */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-dark-300">
            Webhook Secret <span className="text-dark-500">(recommended)</span>
          </label>
          <button
            type="button"
            onClick={generateSecret}
            className="text-xs text-primary-400 hover:text-primary-300"
          >
            Generate Secret
          </button>
        </div>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Enter or generate a secret for HMAC validation"
            className="w-full px-3 py-2 pr-20 bg-dark-900 border border-dark-700 rounded-lg
                     text-dark-100 placeholder-dark-500 font-mono text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-dark-400 hover:text-dark-300"
          >
            {showSecret ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-xs text-dark-500 mt-1">
          If set, requests must include <code className="text-primary-400">X-Webhook-Signature</code> header
          with HMAC-SHA256 signature
        </p>
      </div>

      {/* HMAC Example */}
      {webhookSecret && (
        <div className="p-3 bg-dark-900 rounded-lg border border-dark-700">
          <p className="text-xs text-dark-400 mb-2">Example signature generation (Node.js):</p>
          <pre className="text-xs text-dark-300 overflow-x-auto">
{`const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', '${webhookSecret.slice(0, 8)}...')
  .update(JSON.stringify(body))
  .digest('hex');

// Send with header:
// X-Webhook-Signature: sha256=<signature>`}
          </pre>
        </div>
      )}

      {/* IP Allowlist */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Allowed IP Addresses <span className="text-dark-500">(optional)</span>
        </label>

        {allowedIps.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {allowedIps.map((ip) => (
              <span
                key={ip}
                className="inline-flex items-center gap-1 px-2 py-1 bg-dark-800 rounded text-sm"
              >
                <code className="text-dark-300">{ip}</code>
                <button
                  type="button"
                  onClick={() => removeIp(ip)}
                  className="text-dark-500 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIp())}
            placeholder="e.g., 192.168.1.1 or 10.0.0.0/24"
            className="flex-1 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg
                     text-dark-100 placeholder-dark-500 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={addIp}
            disabled={!newIp}
            className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg
                     text-dark-300 text-sm hover:bg-dark-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-dark-500 mt-1">
          If empty, requests from any IP are allowed
        </p>
      </div>

      {/* Required Headers */}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-2">
          Required Headers <span className="text-dark-500">(optional)</span>
        </label>

        {Object.keys(requireHeaders).length > 0 && (
          <div className="space-y-2 mb-2">
            {Object.entries(requireHeaders).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center gap-2 p-2 bg-dark-800 rounded text-sm"
              >
                <code className="text-primary-400">{key}</code>
                <span className="text-dark-500">=</span>
                <code className="text-dark-300 flex-1">{val}</code>
                <button
                  type="button"
                  onClick={() => removeHeader(key)}
                  className="text-dark-500 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newHeaderKey}
            onChange={(e) => setNewHeaderKey(e.target.value)}
            placeholder="Header name"
            className="flex-1 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg
                     text-dark-100 placeholder-dark-500 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
          />
          <input
            type="text"
            value={newHeaderValue}
            onChange={(e) => setNewHeaderValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHeader())}
            placeholder="Expected value"
            className="flex-1 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg
                     text-dark-100 placeholder-dark-500 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={addHeader}
            disabled={!newHeaderKey || !newHeaderValue}
            className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg
                     text-dark-300 text-sm hover:bg-dark-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-dark-500 mt-1">
          Requests must include these headers with exact values
        </p>
      </div>

      {/* Usage Examples */}
      <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700">
        <h4 className="text-sm font-medium text-dark-300 mb-3">Common Use Cases</h4>
        <div className="space-y-2 text-xs text-dark-400">
          <p>
            <span className="text-primary-400">GitHub Webhooks:</span> Configure in repo settings,
            use secret for signature validation
          </p>
          <p>
            <span className="text-primary-400">Stripe Events:</span> Verify signatures using
            Stripe's webhook signing secret
          </p>
          <p>
            <span className="text-primary-400">Custom Integrations:</span> Trigger actions from
            your own backend services
          </p>
          <p>
            <span className="text-primary-400">IFTTT/Zapier:</span> Connect to no-code automation
            platforms
          </p>
        </div>
      </div>

      {errors?.webhook && <p className="text-xs text-red-400">{errors.webhook}</p>}
    </div>
  );
}
