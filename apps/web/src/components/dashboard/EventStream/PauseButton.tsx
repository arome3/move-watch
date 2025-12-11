'use client';

interface PauseButtonProps {
  isPaused: boolean;
  onToggle: () => void;
}

export function PauseButton({ isPaused, onToggle }: PauseButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        isPaused
          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
      }`}
    >
      {isPaused ? (
        <>
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Resume
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
          Pause
        </>
      )}
    </button>
  );
}
