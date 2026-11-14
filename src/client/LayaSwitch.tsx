/** Laya decision-engine switch beside the composer mode selector. */
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { LayaSwitchFace } from './laya-switch.ts'

/** Framework-derived props for the Laya switch. */
export type LayaSwitchProps = PropsRuntime<'conversation.input.left'> & InjectFace<LayaSwitchFace>

const ROW = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  paddingInline: 2,
  whiteSpace: 'nowrap',
} as const

const LABEL = {
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 500,
  color: 'var(--dsw-alias-text-secondary, #9a9a9a)',
  userSelect: 'none',
} as const

/**
 * Render the Laya decision-engine switch.
 * @param props - the status snapshot and toggle action.
 */
export function LayaSwitch(props: LayaSwitchProps) {
  const state = props.useLayaSwitch(snapshot => snapshot)
  const title = state.error !== null
    ? `Laya: ${state.error}`
    : state.enabled
      ? `Laya decision engine is on${state.healthy ? '' : ' (server starting…)'}`
      : 'Laya decision engine is off; the model is not loaded'
  return (
    <span style={ROW} title={title}>
      <span style={{ ...LABEL, ...state.error === null ? {} : { color: 'var(--dsw-alias-text-error, #e5484d)' } }}>
        Laya
      </span>
      <Switch
        checked={state.enabled}
        onChange={() => { props.toggle() }}
        label="Laya decision engine"
        disabled={state.busy}
        title={title}
      />
    </span>
  )
}
