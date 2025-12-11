'use client';

interface GasStatsProps {
  stats: {
    min: number;
    max: number;
    average: number;
    p95: number;
    total: number;
  };
}

export function GasStats({ stats }: GasStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400 uppercase">Minimum</p>
        <p className="mt-1 text-xl font-bold text-green-400">
          {stats.min.toLocaleString()}
        </p>
      </div>
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400 uppercase">Average</p>
        <p className="mt-1 text-xl font-bold text-blue-400">
          {stats.average.toLocaleString()}
        </p>
      </div>
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400 uppercase">P95</p>
        <p className="mt-1 text-xl font-bold text-yellow-400">
          {stats.p95.toLocaleString()}
        </p>
      </div>
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400 uppercase">Maximum</p>
        <p className="mt-1 text-xl font-bold text-red-400">
          {stats.max.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
