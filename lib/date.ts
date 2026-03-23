export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires"

function getDateParts(date: Date, timeZone = ARGENTINA_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const byType = new Map(parts.map((part) => [part.type, part.value]))

  return {
    year: byType.get("year") || "0000",
    month: byType.get("month") || "01",
    day: byType.get("day") || "01",
  }
}

export function formatDateOnly(date: Date, timeZone = ARGENTINA_TIME_ZONE) {
  const { year, month, day } = getDateParts(date, timeZone)
  return `${year}-${month}-${day}`
}

export function getTodayDateOnly(timeZone = ARGENTINA_TIME_ZONE) {
  return formatDateOnly(new Date(), timeZone)
}

export function normalizeDateOnly(value: string | Date | null | undefined) {
  if (!value) return ""

  if (value instanceof Date) {
    return formatDateOnly(value)
  }

  return String(value).split("T")[0]
}

export function parseDateOnly(value: string) {
  const [year, month, day] = normalizeDateOnly(value).split("-").map(Number)

  if (!year || !month || !day) {
    return new Date(value)
  }

  return new Date(year, month - 1, day)
}

export function addDaysToDateOnly(value: string, days: number) {
  const [year, month, day] = normalizeDateOnly(value).split("-").map(Number)
  const base = new Date(Date.UTC(year, month - 1, day))

  base.setUTCDate(base.getUTCDate() + days)

  return base.toISOString().split("T")[0]
}
