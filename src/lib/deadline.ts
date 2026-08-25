const DAY_IN_MS = 86_400_000

export function daysRemaining(deadlineAt: string | null | undefined, now = new Date()): number | null {
  if (!deadlineAt) return null
  const ms = new Date(deadlineAt).getTime() - now.getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.ceil(ms / DAY_IN_MS))
}
