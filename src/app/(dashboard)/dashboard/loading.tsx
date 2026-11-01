export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4 px-2 sm:space-y-6 sm:px-0">
      <div className="h-44 rounded-2xl border border-slate-800 bg-slate-900" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-7 w-16 rounded bg-muted" />
                <div className="h-3 w-36 rounded bg-muted" />
              </div>
              <div className="h-9 w-9 rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-10 w-32 rounded-lg bg-muted" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 rounded-lg border bg-card lg:col-span-2" />
        <div className="h-80 rounded-lg border bg-card" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-64 rounded-lg border bg-card" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-96 rounded-lg border bg-card lg:col-span-2" />
        <div className="h-96 rounded-lg border bg-card" />
      </div>
    </div>
  )
}
