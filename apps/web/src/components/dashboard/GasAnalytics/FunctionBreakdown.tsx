'use client';

interface FunctionData {
  functionName: string;
  moduleAddress: string;
  totalGas: number;
  avgGas: number;
  count: number;
}

interface FunctionBreakdownProps {
  data: FunctionData[];
}

export function FunctionBreakdown({ data }: FunctionBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <h4 className="text-sm font-medium text-slate-400 uppercase">
          Top Functions by Gas
        </h4>
        <p className="mt-4 text-sm text-slate-500 text-center">
          No function data available
        </p>
      </div>
    );
  }

  const maxGas = Math.max(...data.map((f) => f.totalGas));

  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <h4 className="text-sm font-medium text-slate-400 uppercase mb-4">
        Top Functions by Gas
      </h4>
      <div className="space-y-3">
        {data.map((func, index) => (
          <div key={`${func.moduleAddress}::${func.functionName}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white truncate flex-1">
                <span className="text-slate-400">{index + 1}.</span>{' '}
                <span className="text-primary-400">{func.functionName}</span>
              </span>
              <span className="text-sm text-slate-400 ml-2">
                {func.avgGas.toLocaleString()} avg
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{
                    width: `${(func.totalGas / maxGas) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs text-slate-500 w-16 text-right">
                {func.count} txs
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
