export default function SettingsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-8 bg-dark-800 rounded w-32 mb-2" />
        <div className="h-4 bg-dark-800 rounded w-64 mb-8" />

        {/* Tabs skeleton */}
        <div className="flex gap-4 mb-6 border-b border-dark-700 pb-3">
          <div className="h-8 bg-dark-800 rounded w-20" />
          <div className="h-8 bg-dark-800 rounded w-28" />
          <div className="h-8 bg-dark-800 rounded w-24" />
        </div>

        {/* Content skeleton */}
        <div className="bg-dark-800/50 rounded-lg border border-dark-700 p-6">
          <div className="space-y-6">
            <div>
              <div className="h-4 bg-dark-700 rounded w-24 mb-2" />
              <div className="h-10 bg-dark-700 rounded" />
            </div>
            <div>
              <div className="h-4 bg-dark-700 rounded w-32 mb-2" />
              <div className="h-10 bg-dark-700 rounded" />
            </div>
            <div>
              <div className="h-4 bg-dark-700 rounded w-20 mb-2" />
              <div className="h-10 bg-dark-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
