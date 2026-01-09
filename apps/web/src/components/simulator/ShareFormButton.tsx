'use client';

import { useState, useCallback } from 'react';
import { useSimulatorStore } from '@/stores/simulator';

export function ShareFormButton() {
  const { getShareableUrl } = useSimulatorStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const url = getShareableUrl();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [getShareableUrl]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all
                 ${copied
                   ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                   : 'bg-dark-700 border border-dark-600 text-dark-300 hover:bg-dark-600 hover:text-dark-200'
                 }`}
    >
      {copied ? (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share Form
        </>
      )}
    </button>
  );
}
