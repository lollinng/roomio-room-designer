import { useMemo } from 'react'
import { useStore } from '../store'
import { evaluate, type Suggestion } from '../suggestions/engine'

/**
 * Design-suggestion dropdown. Re-evaluates the rulebook on every scene change
 * and surfaces dismissible, advisory cards — necessity gaps first, then polish.
 * Nothing here is ever auto-applied or blocking.
 */
export function Suggestions() {
  const design = useStore((s) => s.design)
  const dismissed = useStore((s) => s.dismissedSuggestions)
  const dismiss = useStore((s) => s.dismissSuggestion)
  const addFurnitureCentered = useStore((s) => s.addFurnitureCentered)
  const selectFurniture = useStore((s) => s.selectFurniture)

  // Recomputed whenever the design (furniture / materials / room) changes.
  const all = useMemo(() => evaluate(design), [design])
  const visible = all.filter((s) => !dismissed.includes(s.rule_id))

  if (visible.length === 0) return null

  const necessity = visible.filter((s) => s.tier === 'necessity')
  const polish = visible.filter((s) => s.tier === 'polish')

  const onAdd = (s: Suggestion) => {
    if (!s.suggest_archetype) return
    const id = addFurnitureCentered(s.suggest_archetype)
    if (id) selectFurniture(id)
  }

  return (
    <div
      style={{
        marginBottom: 18,
        border: '1.5px solid #e6e3dd',
        borderRadius: 14,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '11px 14px',
          fontSize: 13,
          fontWeight: 800,
          color: 'var(--ink)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid #efece6',
          background: '#fbfaf7',
        }}
      >
        <span>💡 Suggestions</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
          {necessity.length > 0 ? `${necessity.length} to fix · ` : ''}
          {polish.length} polish
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {[...necessity, ...polish].map((s) => (
          <SuggestionRow key={s.rule_id} s={s} onAdd={() => onAdd(s)} onDismiss={() => dismiss(s.rule_id)} />
        ))}
      </div>
    </div>
  )
}

function SuggestionRow({
  s,
  onAdd,
  onDismiss,
}: {
  s: Suggestion
  onAdd: () => void
  onDismiss: () => void
}) {
  const isNecessity = s.tier === 'necessity'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '11px 14px',
        borderTop: '1px solid #f2efe9',
      }}
    >
      <span
        title={isNecessity ? 'Necessity' : 'Polish'}
        style={{
          marginTop: 3,
          width: 8,
          height: 8,
          borderRadius: 999,
          flex: 'none',
          background: isNecessity ? '#c0392b' : '#d8a93a',
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{s.message}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>
          {s.rationale}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {s.suggest_archetype && (
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 'none', padding: '4px 12px' }}
              onClick={onAdd}
            >
              + Add{s.suggest_name ? ` ${s.suggest_name}` : ''}
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 'none', padding: '4px 12px' }}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
