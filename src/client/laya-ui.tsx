/**
 * Shared presentation for the Laya judge: one stylesheet and one set of small
 * pieces used by the in-chat turn card and the per-call tool view.
 *
 * The visual language is copied from the native changed-files card
 * (`ChangedFiles.module.css`): a flat 60px header on a neutral fill, a 40px
 * rounded tile, a 13px title with a 10px stat line, and 11px code-font rows.
 * Keeping it in one module stops the two surfaces from drifting apart.
 *
 * The judge returns more than a verdict, so the answer row renders what the
 * numbers mean: a yes/no criterion, a score against its legend, a chosen class,
 * the confidence, and the full probability distribution when the model gave one.
 *
 * @module dsh-totem/client/laya-ui
 */
import { useMemo } from 'react'

/** Verdict object returned by `decision_ask` and recorded by the Host. */
export interface LayaVerdict {
  verdict?: string
  composite?: number | null
  margin?: number | null
  threshold?: number
  vetoes?: string[]
  failures?: { key?: string; message?: string }[]
  missing?: string[]
  answers?: Record<string, LayaAnswer>
  paths?: string[]
  findings?: { rule?: string; severity?: string; detail?: string; path?: string }[]
  authoritative?: boolean
  /** reviewOnly: advisory review, no corrective message was sent. */
  reviewOnly?: boolean
  note?: string
  error?: string
}

/** One judge answer. */
export interface LayaAnswer {
  type?: string
  noul?: number
  score?: number
  choice?: string
  confidence?: number
  legend?: Record<string, string>
  probabilities?: Record<string, number>
  action?: { act_probability?: number }
}

/** Stylesheet shared by every Laya surface. */
export const LAYA_CSS = `
.laya-card{--laya-fill:var(--dsw-static-neutral-50);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-primary);flex-direction:column;margin-top:4px;display:flex;overflow:hidden}
body[data-ds-dark-theme] .laya-card{--laya-fill:var(--dsw-static-neutral-850)}
.laya-head{box-sizing:border-box;background:var(--laya-fill);width:100%;min-width:0;height:60px;color:inherit;font:inherit;text-align:left;border:0;align-items:center;gap:10px;margin:0;padding:8px 10px;display:flex;cursor:pointer;transition:background-color .12s}
.laya-head:hover{background:var(--dsw-static-neutral-100)}
body[data-ds-dark-theme] .laya-head:hover{background:var(--dsw-static-neutral-800)}
.laya-head:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}
.laya-head[data-static=true]{cursor:default}
.laya-head[data-static=true]:hover{background:var(--laya-fill)}
.laya-tile{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-static-neutral-00) 50%, transparent);border-radius:10px;flex:none;place-items:center;width:40px;height:40px;display:grid}
body[data-ds-dark-theme] .laya-tile{background:color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent)}
.laya-titles{flex-direction:column;flex:1;min-width:0;display:flex}
.laya-title{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}
.laya-stat{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;display:inline-flex;align-items:center;gap:6px}
.laya-numbers{font-family:var(--ds-font-family-code);gap:6px;display:inline-flex}
.laya-hint{display:none}
.laya-head:hover .laya-numbers,.laya-head:focus-visible .laya-numbers{display:none}
.laya-head:hover .laya-hint,.laya-head:focus-visible .laya-hint{display:inline}
.laya-head[data-static=true] .laya-numbers{display:inline}
.laya-head[data-static=true] .laya-hint{display:none}
.laya-list{border-top:.5px solid var(--dsw-alias-border-l2);margin:0;padding:0;list-style:none}
.laya-row{box-sizing:border-box;width:100%;min-width:0;min-height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-family:var(--ds-font-family-code);text-align:left;background:0 0;border:0;justify-content:space-between;align-items:center;gap:10px;margin:0;padding:7px 18px 7px 14px;font-size:11px;line-height:18px;display:flex}
.laya-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.laya-row:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover)}
.laya-rowMain{align-items:center;gap:8px;min-width:0;display:flex;overflow:hidden}
.laya-kind{color:var(--dsw-alias-label-secondary);white-space:nowrap}
.laya-verdict{font-weight:600;white-space:nowrap}
.laya-verdict[data-v=pass]{color:var(--dsw-alias-state-success-primary)}
.laya-verdict[data-v=fail]{color:var(--dsw-alias-state-error-primary)}
.laya-verdict[data-v=needs_review]{color:var(--dsw-alias-state-warn-primary,#f5a524)}
.laya-counts{gap:8px;display:inline-flex;white-space:nowrap}
.laya-detail{padding:8px 14px 10px;display:flex;flex-direction:column;gap:8px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}
.laya-detailRow{display:flex;gap:8px;flex-wrap:wrap}
.laya-tag{border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 7px;white-space:nowrap}
.laya-tag[data-error=true]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.laya-pre{margin:0;padding:8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2,transparent);font-family:var(--ds-font-family-code);font-size:10px;line-height:1.45;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.laya-toggle{width:100%;min-height:26px;display:flex;align-items:center;justify-content:center;gap:4px;border:0;border-top:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer;padding:4px}
.laya-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.laya-empty{color:var(--dsw-alias-label-tertiary);font-size:11px}
.laya-prompt{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.laya-prompt b{color:var(--dsw-alias-label-tertiary);font-weight:600}
.laya-meter{display:flex;flex-direction:column;gap:3px}
.laya-meterHead{display:flex;justify-content:space-between;gap:8px;font-family:var(--ds-font-family-code);font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-meterTrack{position:relative;height:6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 18%,transparent);overflow:visible}
.laya-meterFill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--dsw-alias-state-success-primary)}
.laya-meterFill[data-v=fail]{background:var(--dsw-alias-state-error-primary)}
.laya-meterFill[data-v=needs_review]{background:var(--dsw-alias-state-warn-primary,#f5a524)}
.laya-meterMark{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--dsw-alias-label-secondary);border-radius:1px}
.laya-meterLegend{display:flex;justify-content:space-between;font-size:10px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code)}
.laya-answers{display:flex;flex-direction:column}
.laya-answer{padding:7px 0;border-top:.5px dashed var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:3px}
.laya-answer:first-child{border-top:0;padding-top:0}
.laya-answerHead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.laya-answerName{font-size:11px;color:var(--dsw-alias-label-secondary)}
.laya-answerValue{font-family:var(--ds-font-family-code);font-size:11px;font-weight:600}
.laya-answerValue[data-tone=pass]{color:var(--dsw-alias-state-success-primary)}
.laya-answerValue[data-tone=fail]{color:var(--dsw-alias-state-error-primary)}
.laya-answerValue[data-tone=neutral]{color:var(--dsw-alias-label-primary)}
.laya-conf{font-family:var(--ds-font-family-code);font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-meaning{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-bars{display:flex;flex-direction:column;gap:2px;margin-top:1px}
.laya-barRow{display:grid;grid-template-columns:132px 1fr 40px;align-items:center;gap:8px;font-family:var(--ds-font-family-code);font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-barLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.laya-barTrack{height:6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 16%,transparent);overflow:hidden;display:block}
/* The track is a grid item and therefore blockified; the fill inside it is not,
   so without an explicit display its width and height are ignored and the bar
   renders empty. */
.laya-barFill{display:block;height:100%;min-width:2px;border-radius:999px;background:var(--dsw-alias-label-secondary)}
.laya-barRow[data-selected=true] .laya-barLabel,.laya-barRow[data-selected=true] .laya-barValue{color:var(--dsw-alias-label-primary)}
.laya-barRow[data-selected=true] .laya-barFill{background:var(--dsw-alias-state-business-primary,#6ea8fe)}
.laya-barRow[data-risk=true] .laya-barFill{background:var(--dsw-alias-state-error-primary)}
.laya-barValue{text-align:right}
`

let installed = false

/** Install the stylesheet once per page. */
export function installLayaStyles(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  if (document.querySelector('style[data-dsh-totem-laya]') !== null) return
  const tag = document.createElement('style')
  tag.dataset.dshTotemLaya = ''
  tag.textContent = LAYA_CSS
  document.head.appendChild(tag)
}

/** Color for a judge verdict. */
export function verdictColor(verdict: string): string {
  if (verdict === 'pass') return 'var(--dsw-alias-state-success-primary)'
  if (verdict === 'fail') return 'var(--dsw-alias-state-error-primary)'
  return 'var(--dsw-alias-state-warn-primary,#f5a524)'
}

/** Turn `requirements_met` / `bugClass` into `Requirements met` / `Bug class`. */
export function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .trim()
  if (spaced.length === 0) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Value label for one answer: the number itself, not the question restated. */
export function answerValue(answer: LayaAnswer): string {
  if (answer.score !== undefined) return answer.score.toFixed(2)
  if (answer.choice !== undefined) return answer.choice
  if (answer.noul !== undefined) return answer.noul >= 0.5 ? 'yes' : 'no'
  return '?'
}

/** Tone used to color the value. */
export function answerTone(answer: LayaAnswer): 'pass' | 'fail' | 'neutral' {
  if (answer.noul !== undefined) return answer.noul >= 0.5 ? 'pass' : 'fail'
  // The score legend is 0 = no bug … 3 = definitely buggy.
  if (answer.score !== undefined) return answer.score >= 2 ? 'fail' : answer.score >= 1 ? 'neutral' : 'pass'
  return 'neutral'
}

/** Nearest legend label for a score answer. */
export function nearestLegend(answer: LayaAnswer): string | undefined {
  const { legend, score } = answer
  if (legend === undefined || score === undefined) return undefined
  const keys = Object.keys(legend)
    .filter(key => Number.isFinite(Number(key)))
    .map(Number)
  if (keys.length === 0) return undefined
  const nearest = keys.reduce(
    (best, key) => Math.abs(key - score) < Math.abs(best - score) ? key : best,
    keys[0],
  )
  return legend[String(nearest)]
}

/** One sentence explaining what the answer means. */
export function answerMeaning(name: string, answer: LayaAnswer): string {
  const subject = humanize(name).toLowerCase()
  if (answer.noul !== undefined) {
    return answer.noul >= 0.5
      ? `${subject} is satisfied`
      : `${subject} is not satisfied`
  }
  if (answer.score !== undefined) {
    const legend = nearestLegend(answer)
    return legend === undefined ? 'graded score' : `closest grade: ${legend}`
  }
  if (answer.choice !== undefined) {
    return `chosen ${subject}: ${answer.choice}`
  }
  return 'no value'
}

/** Confidence as a short parenthetical. */
export function confidenceLabel(answer: LayaAnswer): string {
  return answer.confidence === undefined ? '' : `confidence ${answer.confidence.toFixed(2)}`
}

/** Key of the legend bucket nearest to a graded score. */
export function nearestLegendKey(answer: LayaAnswer): string | undefined {
  const { legend, score } = answer
  if (legend === undefined || score === undefined) return undefined
  const keys = Object.keys(legend).filter(key => Number.isFinite(Number(key)))
  if (keys.length === 0) return undefined
  return keys.reduce(
    (best, key) => Math.abs(Number(key) - score) < Math.abs(Number(best) - score) ? key : best,
    keys[0],
  )
}

/** One distribution row: the bucket key, its display label, and its probability. */
export interface BarEntry {
  key: string
  label: string
  value: number
}

/**
 * Distribution rows in a readable order.
 *
 * A graded score keeps its legend order (0…3) so the axis reads as a scale, and
 * its labels come from the legend instead of bare bucket numbers. A choice answer
 * has no natural order, so its buckets are ranked by probability.
 */
export function probabilityEntries(answer: LayaAnswer, max = 5): BarEntry[] {
  const probabilities = answer.probabilities ?? {}
  const numeric = Object.fromEntries(
    Object.entries(probabilities).filter(([, value]) => typeof value === 'number'),
  ) as Record<string, number>
  if (answer.legend !== undefined) {
    return Object.keys(answer.legend)
      .filter(key => Number.isFinite(Number(key)))
      .sort((left, right) => Number(left) - Number(right))
      .map(key => ({ key, label: answer.legend?.[key] ?? key, value: numeric[key] ?? 0 }))
  }
  return Object.entries(numeric)
    .map(([key, value]) => ({ key, label: key === 'none' ? 'none' : humanize(key), value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, max)
}

/** One probability row, with the selected or hazardous bucket highlighted. */
function ProbabilityBars({ answer }: { answer: LayaAnswer }) {
  const entries = probabilityEntries(answer)
  if (entries.length === 0) return null
  const selected = answer.choice ?? nearestLegendKey(answer)
  return (
    <div className="laya-bars">
      {entries.map(({ key, label, value }) => {
        const isSelected = selected !== undefined && key === selected
        const isRisk = answer.score !== undefined && Number(key) >= 2
        return (
          <div
            key={key}
            className="laya-barRow"
            data-selected={isSelected}
            data-risk={isRisk && !isSelected}
          >
            <span className="laya-barLabel" title={label}>{label}</span>
            <span className="laya-barTrack">
              <span
                className="laya-barFill"
                style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
              />
            </span>
            <span className="laya-barValue">{value.toFixed(3)}</span>
          </div>
        )
      })}
    </div>
  )
}

/** One answer: name, value, meaning, confidence, and distribution. */
export function AnswerRow({ name, answer }: { name: string; answer: LayaAnswer }) {
  const confidence = confidenceLabel(answer)
  return (
    <div className="laya-answer">
      <div className="laya-answerHead">
        <span className="laya-answerName">{humanize(name)}</span>
        <span className="laya-answerValue" data-tone={answerTone(answer)}>{answerValue(answer)}</span>
        {confidence.length === 0 ? null : <span className="laya-conf">{confidence}</span>}
      </div>
      <span className="laya-meaning">{answerMeaning(name, answer)}</span>
      <ProbabilityBars answer={answer} />
    </div>
  )
}

/** Every answer, in the order the judge returned them. */
export function Answers({ answers }: { answers: Record<string, LayaAnswer> }) {
  const entries = Object.entries(answers)
  if (entries.length === 0) return <div className="laya-empty">The judge returned no answers.</div>
  return (
    <div className="laya-answers">
      {entries.map(([name, answer]) => <AnswerRow key={name} name={name} answer={answer} />)}
    </div>
  )
}

/**
 * Composite score against the accept threshold.
 *
 * The bar is the whole 0..1 scale with a marker at the threshold, so "0.53 vs
 * 0.65" is visible as distance rather than as two numbers the reader must
 * compare.
 */
export function ScoreMeter({ value, threshold }: { value?: number | null; threshold?: number }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const scale = Math.max(1, value, threshold ?? 0)
  const fill = Math.max(0, Math.min(1, value / scale))
  const mark = threshold === undefined ? undefined : Math.max(0, Math.min(1, threshold / scale))
  const tone = threshold === undefined ? undefined : value >= threshold ? 'pass' : 'fail'
  return (
    <div className="laya-meter">
      <div className="laya-meterHead">
        <span>{`composite ${value.toFixed(3)}`}</span>
        {threshold === undefined ? null : <span>{`threshold ${threshold.toFixed(2)}`}</span>}
        {threshold === undefined ? null : (
          <span>{value >= threshold ? `+${(value - threshold).toFixed(3)} above` : `${(threshold - value).toFixed(3)} below`}</span>
        )}
      </div>
      <div className="laya-meterTrack">
        <span className="laya-meterFill" data-v={tone} style={{ width: `${fill * 100}%` }} />
        {mark === undefined ? null : <span className="laya-meterMark" style={{ left: `calc(${mark * 100}% - 1px)` }} />}
      </div>
      <div className="laya-meterLegend"><span>0</span><span>1</span></div>
    </div>
  )
}

/** The user prompt a call was judging, always labeled. */
export function PromptLine({ text }: { text: string }) {
  if (text.trim().length === 0) return null
  return <div className="laya-prompt"><b>Prompt: </b>{text}</div>
}

/** Latency label that drops meaningless zero values. */
export function latencyLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`
}

/** Local wall-clock label for one timestamp. */
export function clockLabel(ts: string): string {
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString()
}

const TOKEN = /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g

/** Minimal JSON highlighter; keys, strings, numbers, and literals get colors. */
export function JsonView({ value }: { value: unknown }) {
  const chunks = useMemo(() => {
    const text = JSON.stringify(value, null, 2) ?? 'null'
    return text.split(TOKEN).map((chunk, index) => {
      if (index % 2 === 0) return <span key={index}>{chunk}</span>
      const color = chunk.trimEnd().endsWith(':')
        ? 'var(--dsw-alias-state-business-primary,#6ea8fe)'
        : chunk.startsWith('"')
          ? 'var(--dsw-alias-state-success-primary)'
          : /^\d/.test(chunk)
            ? 'var(--dsw-alias-state-warn-primary,#e0b45c)'
            : 'var(--dsw-alias-state-error-primary)'
      return <span key={index} style={{ color }}>{chunk}</span>
    })
  }, [value])
  return <pre className="laya-pre">{chunks}</pre>
}

/** The shield-check tile glyph. */
export function LayaGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" color="var(--dsw-alias-label-primary)">
      <path d="M12 3.2 19 6v5.1c0 4.2-2.9 7.5-7 8.9-4.1-1.4-7-4.7-7-8.9V6l7-2.8Z" stroke="currentColor" strokeWidth="1.35" />
      <path d="m8.8 11.8 2.2 2.2 4.2-4.3" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  )
}
