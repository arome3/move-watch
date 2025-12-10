'use client';

import { useSimulatorStore } from '@/stores/simulator';

export function TypeArguments() {
  const { typeArguments, addTypeArgument, removeTypeArgument, setTypeArgument } =
    useSimulatorStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-300">
          Type Arguments
        </label>
        <button
          type="button"
          onClick={addTypeArgument}
          className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
        >
          + Add Type
        </button>
      </div>

      {typeArguments.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No type arguments</p>
      ) : (
        <div className="space-y-2">
          {typeArguments.map((arg, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-6">{index + 1}.</span>
              <input
                type="text"
                value={arg}
                onChange={(e) => setTypeArgument(index, e.target.value)}
                placeholder="0x1::aptos_coin::AptosCoin"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm
                          font-mono text-slate-100 placeholder:text-slate-600
                          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                          transition-colors"
              />
              <button
                type="button"
                onClick={() => removeTypeArgument(index)}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                aria-label="Remove type argument"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Generic type parameters for the function (e.g., coin types)
      </p>
    </div>
  );
}
