/**
 * Diagramfärger.
 *
 * Serieordningen är validerad — inte vald på känsla. Alla sju stegen kommer ur
 * SvD:s egna skalor och klarar ljushetsband, kromagolv, färgblindhetsseparation
 * (protan/deutan), normalseendegolvet och 3:1 kontrast mot diagramytan i både
 * ljust och mörkt läge. Ändra inte ordningen utan att köra om valideringen:
 * ordningen är själva skyddsmekanismen, inte dekoration.
 */
export const SERIES = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)',
] as const

export const SERIES_MAX = SERIES.length
export const OTHER_COLOR = 'var(--series-other)'

/** Färgen följer personen, aldrig placeringen i en filtrerad lista. */
export function seriesColor(index: number): string {
  return index < SERIES_MAX ? SERIES[index] : OTHER_COLOR
}

export const CATEGORY_COLORS: Record<string, string> = {
  avsnitt: 'var(--cat-avsnitt)',
  inlasningar: 'var(--cat-inlasningar)',
  kringarbete: 'var(--cat-kringarbete)',
}

export function categoryColor(slug: string, fallback = 'var(--series-other)'): string {
  return CATEGORY_COLORS[slug] ?? fallback
}

/** Enfärgad skala för värmekartan: ljus = nära noll, mörk = mycket. */
export const HEAT = ['var(--heat-0)','var(--heat-1)','var(--heat-2)','var(--heat-3)','var(--heat-4)','var(--heat-5)']

export function heatColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return HEAT[0]
  const step = Math.min(HEAT.length - 1, Math.max(1, Math.ceil((value / max) * (HEAT.length - 1))))
  return HEAT[step]
}

export const EVENT_KINDS: Record<string, { label: string; color: string }> = {
  process:   { label: 'Process',   color: 'var(--series-3)' },
  upload:    { label: 'Uppladdning', color: 'var(--series-4)' },
  equipment: { label: 'Teknik',    color: 'var(--series-5)' },
  staffing:  { label: 'Bemanning', color: 'var(--series-6)' },
  other:     { label: 'Övrigt',    color: 'var(--series-other)' },
}

/** Textsäkra motsvarigheter till serifärgerna (>= 4,5:1 mot kortytan). */
export const SERIES_TEXT = [
  'var(--text-1)', 'var(--text-2)', 'var(--text-3)', 'var(--text-4)',
  'var(--text-5)', 'var(--text-6)', 'var(--text-7)',
] as const

export const OTHER_TEXT = 'var(--text-other)'

/**
 * Färgen som hör till en programledare.
 *
 * Nyckeln är personens plats i den fasta listan — inte hens plats i en
 * sorterad eller filtrerad vy. Annars byter färgerna plats så fort någon
 * filtrerar, och samma person är blå i ett diagram och röd i nästa.
 */
export function hostColorIndex(slug: string, allSlugs: readonly string[]): number {
  return allSlugs.indexOf(slug)
}

export function hostColor(slug: string, allSlugs: readonly string[]): string {
  const i = hostColorIndex(slug, allSlugs)
  return i >= 0 && i < SERIES_MAX ? SERIES[i] : OTHER_COLOR
}

export function hostTextColor(slug: string, allSlugs: readonly string[]): string {
  const i = hostColorIndex(slug, allSlugs)
  return i >= 0 && i < SERIES_MAX ? SERIES_TEXT[i] : OTHER_TEXT
}
