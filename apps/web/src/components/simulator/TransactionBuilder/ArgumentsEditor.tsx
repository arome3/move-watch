'use client';

import { useState } from 'react';
import { useSimulatorStore } from '@/stores/simulator';

export function ArgumentsEditor() {
  const {
    argumentsJson,
    setArgumentsJson,
    argumentFields,
    argumentValues,
    setArgumentValue,
    errors,
  } = useSimulatorStore();

  const [showRawJson, setShowRawJson] = useState(false);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(argumentsJson);
      setArgumentsJson(JSON.stringify(parsed, null, 2));
    } catch {
      // Invalid JSON, can't format
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(argumentsJson);
      setArgumentsJson(JSON.stringify(parsed));
    } catch {
      // Invalid JSON, can't minify
    }
  };

  // Render type badge with color coding
  const renderTypeBadge = (type: string) => {
    let colorClass = 'bg-dark-700 text-dark-300';
    const lowerType = type.toLowerCase();

    if (lowerType === 'address' || lowerType.includes('address')) {
      colorClass = 'bg-purple-500/20 text-purple-400';
    } else if (lowerType === 'bool') {
      colorClass = 'bg-blue-500/20 text-blue-400';
    } else if (lowerType.startsWith('u')) {
      colorClass = 'bg-green-500/20 text-green-400';
    } else if (lowerType.includes('vector') || lowerType.includes('[]')) {
      colorClass = 'bg-yellow-500/20 text-yellow-400';
    } else if (lowerType.includes('string')) {
      colorClass = 'bg-pink-500/20 text-pink-400';
    }

    return (
      <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${colorClass}`}>
        {type}
      </span>
    );
  };

  // If we have argument field metadata, show individual inputs
  const hasFieldInfo = argumentFields.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-dark-300">
          Function Arguments
        </label>
        <div className="flex gap-2 items-center">
          {hasFieldInfo && (
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                showRawJson
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-dark-400 hover:text-dark-300'
              }`}
            >
              {showRawJson ? 'Show Fields' : 'Show JSON'}
            </button>
          )}
          {(!hasFieldInfo || showRawJson) && (
            <>
              <button
                type="button"
                onClick={handleFormat}
                className="text-xs text-dark-400 hover:text-dark-300 transition-colors"
              >
                Format
              </button>
              <button
                type="button"
                onClick={handleMinify}
                className="text-xs text-dark-400 hover:text-dark-300 transition-colors"
              >
                Minify
              </button>
            </>
          )}
        </div>
      </div>

      {/* Individual input fields when we have type information */}
      {hasFieldInfo && !showRawJson ? (
        <div className="space-y-3">
          {argumentFields.map((field, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`arg-${index}`}
                  className="text-sm text-dark-300 font-medium"
                >
                  {field.name || `Argument ${index + 1}`}
                </label>
                {renderTypeBadge(field.type)}
                {field.required && (
                  <span className="text-red-400 text-xs">*</span>
                )}
              </div>

              {/* Boolean toggle */}
              {field.inputType === 'boolean' ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setArgumentValue(index, 'true')}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      argumentValues[index] === 'true'
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'bg-dark-900 border-dark-700 text-dark-400 hover:border-dark-600'
                    }`}
                  >
                    true
                  </button>
                  <button
                    type="button"
                    onClick={() => setArgumentValue(index, 'false')}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      argumentValues[index] === 'false'
                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : 'bg-dark-900 border-dark-700 text-dark-400 hover:border-dark-600'
                    }`}
                  >
                    false
                  </button>
                </div>
              ) : field.inputType === 'array' || field.inputType === 'object' ? (
                /* Textarea for arrays and objects */
                <textarea
                  id={`arg-${index}`}
                  value={argumentValues[index] || ''}
                  onChange={(e) => setArgumentValue(index, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm font-mono
                           text-dark-100 placeholder:text-dark-600 focus:outline-none focus:ring-2
                           focus:ring-primary-500 focus:border-transparent transition-colors resize-none"
                />
              ) : (
                /* Regular input for text, numbers, addresses */
                <input
                  id={`arg-${index}`}
                  type="text"
                  value={argumentValues[index] || ''}
                  onChange={(e) => setArgumentValue(index, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono
                           text-dark-100 placeholder:text-dark-600 focus:outline-none focus:ring-2
                           focus:ring-primary-500 focus:border-transparent transition-colors
                           ${field.inputType === 'address' ? 'tracking-tight' : ''}
                           border-dark-700`}
                />
              )}

              {/* Description hint */}
              {field.description && field.description !== `Argument ${index + 1}` && (
                <p className="text-xs text-dark-500">{field.description}</p>
              )}
            </div>
          ))}

          {/* Show generated JSON preview */}
          <div className="bg-dark-900/50 border border-dark-800 rounded-lg px-3 py-2">
            <p className="text-xs text-dark-500 mb-1">Generated JSON:</p>
            <code className="text-xs text-primary-400 font-mono break-all">
              {argumentsJson}
            </code>
          </div>
        </div>
      ) : (
        /* Fallback to raw JSON editor */
        <>
          <div className="relative">
            <textarea
              id="arguments"
              value={argumentsJson}
              onChange={(e) => setArgumentsJson(e.target.value)}
              placeholder='["arg1", "arg2"]'
              rows={5}
              className={`w-full bg-dark-900 border rounded-lg px-3 py-2 text-sm font-mono text-dark-100
                       placeholder:text-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500
                       focus:border-transparent transition-colors resize-none
                       ${errors.argumentsJson ? 'border-red-500' : 'border-dark-700'}`}
            />
          </div>

          {errors.argumentsJson ? (
            <p className="text-xs text-red-400">{errors.argumentsJson}</p>
          ) : (
            <p className="text-xs text-dark-500">
              Enter function arguments as a JSON array
            </p>
          )}

          {/* Example hint */}
          <div className="bg-dark-900/50 border border-dark-800 rounded-lg px-3 py-2">
            <p className="text-xs text-dark-500">
              Example: <code className="text-primary-400">["0xaddress...", "1000000"]</code>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
