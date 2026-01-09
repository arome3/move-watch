'use client';

import { useState, useEffect } from 'react';

interface RefreshButtonProps {
  onRefresh: () => void;
  lastUpdated?: number;
  autoRefreshInterval?: number; // in milliseconds
}

export function RefreshButton({
  onRefresh,
  lastUpdated,
  autoRefreshInterval = 30000,
}: RefreshButtonProps) {
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    Math.floor(autoRefreshInterval / 1000)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!lastUpdated) return;

    const updateCountdown = () => {
      const elapsed = Date.now() - lastUpdated;
      const remaining = Math.max(
        0,
        Math.floor((autoRefreshInterval - elapsed) / 1000)
      );
      setSecondsUntilRefresh(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated, autoRefreshInterval]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      onRefresh();
    } finally {
      // Brief delay to show loading state
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds >= 60) {
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-dark-500">
        Refreshes in {formatTime(secondsUntilRefresh)}
      </span>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-dark-300 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 hover:text-white transition-colors disabled:opacity-50"
      >
        <svg
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}
