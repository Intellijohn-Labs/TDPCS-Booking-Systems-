export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-lg"></div>
          <div className="h-3 w-72 bg-slate-100 rounded-md"></div>
        </div>
        <div className="h-9 w-28 bg-slate-200 rounded-xl"></div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-100 rounded-xl"></div>
          <div className="h-24 bg-slate-100 rounded-xl"></div>
          <div className="h-24 bg-slate-100 rounded-xl"></div>
        </div>

        <div className="h-64 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center">
          <div className="flex flex-col items-center space-y-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-800 border-t-transparent animate-spin rounded-full"></div>
            <span className="text-xs font-medium">Loading section...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
