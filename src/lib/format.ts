export function parseDateValue(value?: string | null): Date | null {
  if (!value) return null
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateId(value?: string | null): string {
  const date = parseDateValue(value)
  return date ? date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"
}

export function formatDateTimeId(value?: string | null): string {
  const date = parseDateValue(value)
  return date
    ? date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-"
}

export function formatLongDateId(value?: string | null): string {
  const date = parseDateValue(value)
  return date ? date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim()
}
