/** Svensk formatering av tider, tal och datum. */

const nf = (min = 0, max = 1) =>
  new Intl.NumberFormat('sv-SE', { minimumFractionDigits: min, maximumFractionDigits: max })

/**
 * 5 400 s → "1 h 30 min".
 *
 * Vid många timmar utelämnas minuterna: i "2 215 h 15 min" bär de sista
 * siffrorna ingen information, men de gör talet dubbelt så långt och tvingar
 * det att radbrytas i ett nyckeltal.
 */
export function humanDuration(seconds: number, opts: { short?: boolean } = {}): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '–'
  const totalMin = Math.round(seconds / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0 || h >= 100 || (opts.short && h >= 10)) return `${nf(0, 0).format(h)} h`
  return `${nf(0, 0).format(h)} h ${m} min`
}

/** 2 730 s → "0:45:30". Formatet som CSV:n använder. */
export function clockDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** "0:45:30" eller "45" (minuter) → sekunder. Tolerant mot hur folk skriver. */
export function parseDuration(input: string): number | null {
  const t = input.trim()
  if (t === '') return null
  if (/^\d+$/.test(t)) return parseInt(t, 10) * 60 // enbart siffror = minuter
  if (!/^\d{1,3}(:\d{1,2}){1,2}$/.test(t)) return null
  const p = t.split(':').map(Number)
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 3600 + p[1] * 60
}

export const minutes = (seconds: number) => seconds / 60
export const hours = (seconds: number) => seconds / 3600

export const num = (v: number, decimals = 0) =>
  Number.isFinite(v) ? nf(decimals, decimals).format(v) : '–'

export const percent = (v: number | null | undefined, decimals = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? '–' : `${nf(decimals, decimals).format(v)} %`

export const ratio = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? '–' : `${nf(2, 2).format(v)}×`

export const signed = (v: number, decimals = 0) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(decimals, decimals).format(Math.abs(v))}`

const MONTHS = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december']

export function longDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

export function weekdayName(iso: string): string {
  const days = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag']
  return days[new Date(iso + 'T00:00:00').getDay()]
}

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}
