export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="mt-1 h-4 w-48 rounded bg-muted" />
      </div>
      <div className="h-10 w-full rounded bg-muted" />
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 flex-1 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
