/** Token-usage overview: lifetime total, GitHub-style activity graph, and stats. */
import { useEffect, useMemo, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { OverviewData, OverviewResult, OverviewSource } from './overview.ts'
import { ApprovalsSection } from './ApprovalsSection.tsx'

const SURFACE = 'color-mix(in oklab, currentColor 5%, transparent)'
const HAIRLINE = 'color-mix(in oklab, currentColor 16%, transparent)'
const INSET = 'color-mix(in oklab, currentColor 12%, transparent)'
const MUTED_TEXT = 'color-mix(in oklab, currentColor 62%, transparent)'


export interface OverviewFace {
  load: (source?: OverviewSource) => Promise<OverviewResult>
  importHistory: () => Promise<OverviewResult>
}

export type OverviewPageProps = PropsRuntime<'main'> & InjectFace<OverviewFace>

const PAGE = {
  height: '100%',
  overflowY: 'auto',
  padding: '28px 32px 40px',
  display: 'flex',
  justifyContent: 'center',
} as const

const INNER = { width: '100%', maxWidth: 1040, display: 'flex', flexDirection: 'column', gap: 22 } as const

const MUTED = { color: 'MUTED_TEXT', fontSize: 12 } as const

const CARD = {
  border: '1px solid HAIRLINE',
  borderRadius: 12,
  background: 'SURFACE',
  padding: '16px 18px',
} as const

const CHIP = {
  border: '1px solid HAIRLINE',
  borderRadius: 999,
  padding: '3px 10px',
  fontSize: 11,
  cursor: 'pointer',
  background: 'transparent',
  color: 'MUTED_TEXT',
} as const

const COLORS = ['INSET', '#0e3a5c', '#0b5cad', '#1d8cf8', '#4cb3ff'] as const
const SOURCES: { id: OverviewSource; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dsh', label: 'dsh' },
  { id: 'opencode', label: 'opencode' },
  { id: 'encoder', label: 'encoder' },
]

function compact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return String(Math.round(value))
}

function integer(value: number): string {
  return Math.round(value).toLocaleString()
}

function shortDate(date: string): string {
  if (date.length === 0) return '—'
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function shift(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return value.toLocaleDateString('en-CA')
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00`).getDay()
}

interface HeatCell {
  date: string
  value: number
  level: number
  future: boolean
}

function buildWeeks(days: OverviewData['days'], mode: 'daily' | 'cumulative'): HeatCell[][] {
  const totals = new Map<string, number>()
  let running = 0
  for (const day of [...days].sort((left, right) => left.date.localeCompare(right.date))) {
    running += day.tokens
    totals.set(day.date, mode === 'cumulative' ? running : day.tokens)
  }
  const todayKey = new Date().toLocaleDateString('en-CA')
  const start = shift(todayKey, -364)
  const startAligned = shift(start, -dayOfWeek(start))
  const values = [...totals.values()].filter(value => value > 0).sort((left, right) => left - right)
  const threshold = (quantile: number): number =>
    values.length === 0 ? 0 : values[Math.min(values.length - 1, Math.floor(values.length * quantile))]
  const levels = [threshold(0.25), threshold(0.5), threshold(0.75), threshold(0.9)]

  const weeks: HeatCell[][] = []
  for (let week = 0; week < 53; week++) {
    const column: HeatCell[] = []
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = shift(startAligned, week * 7 + weekday)
      const future = date > todayKey
      const value = totals.get(date) ?? 0
      const level = value <= 0
        ? 0
        : value <= levels[0] ? 1
          : value <= levels[1] ? 2
            : value <= levels[2] ? 3
              : 4
      column.push({ date, value, level, future })
    }
    weeks.push(column)
  }
  return weeks
}

function Heatmap({ days, mode }: { days: OverviewData['days']; mode: 'daily' | 'cumulative' }) {
  const weeks = useMemo(() => buildWeeks(days, mode), [days, mode])
  const labels = useMemo(() => {
    let previous = ''
    return weeks.map(column => {
      const month = column[0].date.slice(0, 7)
      if (month === previous) return ''
      previous = month
      return new Date(`${column[0].date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })
    })
  }, [weeks])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '13px', gap: 2, minWidth: 53 * 15 }}>
        {labels.map((label, index) => (
          <span key={index} style={{ ...MUTED, fontSize: 10, whiteSpace: 'nowrap' }}>{label}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '13px', gap: 2, minWidth: 53 * 15 }}>
        {weeks.map((column, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 13px)', gap: 2 }}>
            {column.map(cell => (
              <div
                key={cell.date}
                title={cell.future ? '' : `${cell.date} · ${integer(cell.value)} tokens`}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: cell.future ? 'transparent' : COLORS[cell.level],
                  opacity: cell.future ? 0 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
        <span style={{ ...MUTED, fontSize: 10 }}>Less</span>
        {COLORS.map((color, index) => (
          <span key={index} style={{ width: 11, height: 11, borderRadius: 2, background: color }} />
        ))}
        <span style={{ ...MUTED, fontSize: 10 }}>More</span>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 108 }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{value}</span>
      <span style={{ ...MUTED, fontSize: 11 }}>{label}</span>
    </div>
  )
}

function Failure({ reason, status }: { reason: 'unauthorized' | 'missing-route' | 'offline' | 'error'; status?: number }) {
  const text = reason === 'unauthorized'
    ? 'Set the Totem `apiToken` in Plugins, then reload this page.'
    : reason === 'missing-route'
      ? 'The Host has not loaded the Overview endpoint (404). Restart `dsh-totem` and reload.'
      : reason === 'offline'
        ? 'Cannot reach the Host. Check that the app is running.'
        : `The Host returned an error${status === undefined ? '' : ` (${status})`}.`
  return (
    <div style={{ ...PAGE, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...CARD, maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Overview unavailable</div>
        <div style={MUTED}>{text}</div>
      </div>
    </div>
  )
}

/**
 * Render the usage overview.
 * @param props - the injected loader and importer.
 */
export function OverviewPage(props: OverviewPageProps) {
  const [source, setSource] = useState<OverviewSource>('all')
  const [result, setResult] = useState<OverviewResult | null>(null)
  const [mode, setMode] = useState<'daily' | 'cumulative'>('daily')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      const next = await props.load(source)
      if (active) setResult(next)
    }
    void load()
    const timer = setInterval(() => { void load() }, 60_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [source])

  const runImport = async (): Promise<void> => {
    if (importing) return
    setImporting(true)
    const next = await props.importHistory()
    setImporting(false)
    if (next.ok) {
      setSource('all')
      setResult(await props.load('all'))
    } else {
      setResult(next)
    }
  }

  if (result === null) {
    return <div style={{ ...PAGE, alignItems: 'center', justifyContent: 'center' }}><span style={MUTED}>Loading usage…</span></div>
  }
  if (!result.ok) return <Failure reason={result.reason} status={result.status} />

  const data = result.data
  const total = compact(data.totals.tokens)
  const unit = /[A-Za-z]$/u.exec(total)?.[0] ?? ''
  const digits = unit === '' ? total : total.slice(0, -1)
  const importedAt = data.import.importedAt

  return (
    <div style={PAGE}>
      <div style={INNER}>
        <ApprovalsSection />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {SOURCES.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => { setSource(option.id) }}
                style={{ ...CHIP, ...source === option.id ? { background: 'INSET', color: 'inherit' } : {} }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {importedAt === null
              ? null
              : <span style={{ ...MUTED, fontSize: 11 }}>Imported {new Date(importedAt).toLocaleString()}</span>}
            <button type="button" style={CHIP} onClick={() => { void props.load(source).then(setResult) }}>Refresh</button>
            <button
              type="button"
              style={{ ...CHIP, color: 'inherit', borderColor: 'HAIRLINE' }}
              disabled={importing}
              onClick={() => { void runImport() }}
            >
              {importing ? 'Importing…' : importedAt === null ? 'Import history' : 'Re-import'}
            </button>
          </div>
        </div>

        {data.totals.tokens === 0
          ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No usage for {source}</div>
              <div style={MUTED}>
                Run a turn, or import the opencode/encoder history. Importing scans the message tables once and caches daily totals.
              </div>
            </div>
          )
          : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 56, lineHeight: 1, fontWeight: 650, letterSpacing: '-0.03em' }}>{digits}</span>
                  {unit === '' ? null : <span style={{ fontSize: 26, fontWeight: 600, color: 'MUTED_TEXT' }}>{unit}</span>}
                </div>
                <span style={{ ...MUTED, fontSize: 12 }}>Lifetime tokens</span>
              </div>

              <div style={{ ...CARD, display: 'flex', flexWrap: 'wrap', gap: '16px 28px', justifyContent: 'space-between' }}>
                <Stat label="Lifetime tokens" value={integer(data.totals.tokens)} />
                <Stat label="Peak day" value={compact(data.stats.peak.tokens)} />
                <Stat label="Longest streak" value={`${data.stats.longestStreak} days`} />
                <Stat label="Current streak" value={`${data.stats.currentStreak} days`} />
                <Stat label="Active days" value={integer(data.totals.activeDays)} />
                <Stat label="Sessions" value={integer(data.totals.sessions)} />
                <Stat label="Avg tokens/day" value={compact(data.stats.avgTokensPerDay)} />
                <Stat label="Avg prompts/day" value={String(data.stats.avgPromptsPerDay)} />
                <Stat label="Avg tokens/prompt" value={compact(data.stats.avgTokensPerPrompt)} />
                <Stat label="Avg session tokens" value={compact(data.stats.avgSessionTokens)} />
                <Stat label="Cached tokens" value={compact(data.totals.cacheRead)} />
              </div>

              <div style={CARD}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Token activity</span>
                    <span style={{ ...MUTED, fontSize: 11 }}>
                      {data.totals.prompts.toLocaleString()} prompts · peak {shortDate(data.stats.peak.date)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {(['daily', 'cumulative'] as const).map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => { setMode(option) }}
                        style={{ ...CHIP, ...mode === option ? { background: 'INSET', color: 'inherit' } : {} }}
                      >
                        {option === 'daily' ? 'Daily' : 'Cumulative'}
                      </button>
                    ))}
                  </div>
                </div>
                <Heatmap days={data.days} mode={mode} />
              </div>

              {data.models.length > 0
                ? (
                  <div style={CARD}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Top models</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {data.models.map(model => {
                        const share = data.totals.tokens === 0 ? 0 : model.tokens / data.totals.tokens
                        return (
                          <div key={`${model.provider}/${model.model}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 190, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {model.model.length > 0 ? model.model : model.provider}
                            </span>
                            <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'INSET', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(2, Math.round(share * 100))}%`, height: '100%', background: '#1d8cf8' }} />
                            </div>
                            <span style={{ ...MUTED, fontVariantNumeric: 'tabular-nums', width: 70, textAlign: 'right' }}>{compact(model.tokens)}</span>
                            <span style={{ ...MUTED, fontSize: 11, width: 42, textAlign: 'right' }}>{Math.round(share * 100)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
                : null}

              <div style={{ ...MUTED, fontSize: 11, textAlign: 'center', paddingBottom: 8 }}>
                Updated {new Date(data.generatedAt).toLocaleTimeString()} · {data.totals.input.toLocaleString()} in / {data.totals.output.toLocaleString()} out / {data.totals.cacheRead.toLocaleString()} cached
                {importedAt === null ? '' : ` · history imported ${new Date(importedAt).toLocaleDateString()}`}
              </div>
            </>
          )}
      </div>
    </div>
  )
}
