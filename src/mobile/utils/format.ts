export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0%'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatCountdown(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)))
}

export function formatDateTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts))
  } catch {
    return '—'
  }
}

export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase()
}

export function monogram(name: string): string {
  const chars = Array.from(name.trim()).filter((char) => char.trim().length > 0)
  if (chars.length === 0) return 'SF'
  return chars.slice(0, 2).join('').toUpperCase()
}

export function pluralPlayers(count: number): string {
  return `${count} 人`
}
