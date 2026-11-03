import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"

export type TrendPoint = {
  label: string
  date: string
  total: number
  approved: number
}

export type DonutSlice = {
  label: string
  value: number
  color: string
  className: string
}

export type BarDatum = {
  label: string
  value: number
  color: string
}

export type TankDatum = {
  tank: string
  product: string
  level: number
  water: number
}

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  accent,
  bar,
}: {
  label: string
  value: string | number
  helper: string
  icon: LucideIcon
  accent: string
  bar: string
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">{helper}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  )
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <EmptyState text="Belum ada data tren." />
  }

  const width = 720
  const height = 240
  const padding = { top: 24, right: 16, bottom: 42, left: 34 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(...data.map((point) => point.total), 1)
  const step = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth
  const x = (index: number) => padding.left + index * step
  const y = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight
  const baseline = padding.top + innerHeight

  const totalPoints: [number, number][] = data.map((point, index) => [x(index), y(point.total)])
  const approvedPoints: [number, number][] = data.map((point, index) => [x(index), y(point.approved)])
  const totalPath = buildSmoothPath(totalPoints)
  const approvedPath = buildSmoothPath(approvedPoints)
  const areaPath = `${totalPath} L ${totalPoints[totalPoints.length - 1][0]} ${baseline} L ${totalPoints[0][0]} ${baseline} Z`
  const gridValues = Array.from(new Set([0, Math.round(maxValue / 2), maxValue])).sort((a, b) => a - b)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="Tren handover dan approval tujuh hari terakhir"
        >
          <defs>
            <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--border)"
                strokeDasharray="4 6"
              />
              <text
                x={padding.left - 8}
                y={y(value) + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--muted-foreground)"
              >
                {value}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="url(#trend-area)" />
          <path d={totalPath} fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          <path d={approvedPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

          {data.map((point, index) => (
            <g key={`${point.label}-${point.date}`}>
              <circle cx={x(index)} cy={y(point.total)} r="3.5" fill="#0f172a" stroke="white" strokeWidth="2" />
              <circle cx={x(index)} cy={y(point.approved)} r="3" fill="#10b981" stroke="white" strokeWidth="2" />
              {point.total > 0 && (
                <text
                  x={x(index)}
                  y={y(point.total) - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--foreground)"
                >
                  {point.total}
                </text>
              )}
              <text
                x={x(index)}
                y={height - 22}
                textAnchor="middle"
                fontSize="10"
                fill="var(--muted-foreground)"
              >
                {point.label}
              </text>
              <text
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                fontSize="9"
                fill="var(--muted-foreground)"
              >
                {point.date}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

export function StatusDonut({ data, total }: { data: DonutSlice[]; total: number }) {
  const size = 160
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const activeSlices = data.filter((slice) => slice.value > 0)

  const segments = activeSlices.map((slice, index) => {
    const length = total > 0 ? (slice.value / total) * circumference : 0
    const offset = activeSlices
      .slice(0, index)
      .reduce((sum, item) => sum + (total > 0 ? (item.value / total) * circumference : 0), 0)
    return { ...slice, length, offset }
  })

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" role="img" aria-label="Distribusi status handover">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth="18" />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="18"
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Handover</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {data.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 shrink-0 rounded-full ${slice.className}`} />
            <span className="flex-1 text-muted-foreground">{slice.label}</span>
            <span className="font-semibold tabular-nums">{slice.value}</span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ShiftBars({ data, total }: { data: BarDatum[]; total: number }) {
  const max = Math.max(...data.map((item) => item.value), 1)

  if (data.length === 0) {
    return <EmptyState text="Belum ada data shift." />
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{item.value}</span> &middot; {percentage}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${item.color}`}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TankLevelChart({ data }: { data: TankDatum[] }) {
  if (data.length === 0) {
    return <EmptyState text="Belum ada pembacaan level tank." />
  }

  const max = Math.max(...data.flatMap((item) => [item.level, item.water]), 1)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[460px]">
        <div className="flex items-end gap-3 pt-2">
          {data.map((item) => (
            <div key={item.tank} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-36 items-end justify-center gap-1">
                <div
                  className="relative flex h-full w-5 items-end overflow-hidden rounded-t-sm bg-sky-100"
                  title={`Level ${item.level} mm`}
                >
                  <div
                    className="w-full rounded-t-sm bg-sky-500"
                    style={{ height: `${(item.level / max) * 100}%` }}
                  />
                </div>
                <div
                  className="relative flex h-full w-3 items-end overflow-hidden rounded-t-sm bg-amber-100"
                  title={`Water ${item.water} mm`}
                >
                  <div
                    className="w-full rounded-t-sm bg-amber-500"
                    style={{ height: `${(item.water / max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold">{item.tank}</p>
                <p className="max-w-[64px] truncate text-[10px] text-muted-foreground">{item.product || "-"}</p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {item.level.toLocaleString("id-ID")} mm
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-sky-500" /> Level
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-amber-500" /> Water
          </span>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  )
}

function buildSmoothPath(points: [number, number][]) {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`

  let path = `M ${points[0][0]} ${points[0][1]}`
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[index - 1] ?? points[index]
    const current = points[index]
    const next = points[index + 1]
    const afterNext = points[index + 2] ?? next
    const control1X = current[0] + (next[0] - previous[0]) / 6
    const control1Y = current[1] + (next[1] - previous[1]) / 6
    const control2X = next[0] - (afterNext[0] - current[0]) / 6
    const control2Y = next[1] - (afterNext[1] - current[1]) / 6
    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next[0]} ${next[1]}`
  }
  return path
}
