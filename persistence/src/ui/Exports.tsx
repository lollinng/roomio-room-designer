/**
 * Exports section (brief §5). Image snapshot, furniture shopping list, floor-plan
 * PDF, and flythrough video (via Agent B). Implemented in C2-5; this is the stub
 * shape the Share panel renders so the layout is stable.
 */
import type { CSSProperties } from 'react'
import type { RoomioDesign } from '../envelope/types'
import { T } from '../ui/theme'

export function ExportsSection({ design: _design }: { design: RoomioDesign }) {
  return <div style={note}>Image, shopping list, floor-plan PDF & video — coming in C2-5.</div>
}

const note: CSSProperties = { fontSize: 12, color: T.inkFaint, fontStyle: 'italic', marginTop: 4 }
