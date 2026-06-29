// Unified async designs repository. When the user is logged in, designs persist
// to the Postgres-backed server (per-user). Otherwise they fall back to the
// browser's localStorage (guest / offline mode). Both StartScreen and Wizard
// talk only to this module, so the storage backend is a single swap point.

import type { RoomDesign } from './types'
import type { DesignSummary } from './persistence'
import {
  listDesigns as localList,
  saveDesign as localSave,
  loadDesign as localLoad,
  deleteDesign as localDelete,
} from './persistence'
import { api } from './api'
import { useAuth } from './auth'

function isAuthed(): boolean {
  return useAuth.getState().status === 'authed'
}

export async function listDesigns(): Promise<DesignSummary[]> {
  if (isAuthed()) {
    return api.get<DesignSummary[]>('/designs')
  }
  return localList()
}

export async function loadDesign(id: string): Promise<RoomDesign | null> {
  if (isAuthed()) {
    try {
      return await api.get<RoomDesign>(`/designs/${encodeURIComponent(id)}`)
    } catch {
      return null
    }
  }
  return localLoad(id)
}

export async function saveDesign(d: RoomDesign): Promise<void> {
  if (isAuthed()) {
    await api.post('/designs', d)
    return
  }
  localSave(d)
}

export async function deleteDesign(id: string): Promise<void> {
  if (isAuthed()) {
    await api.del(`/designs/${encodeURIComponent(id)}`)
    return
  }
  localDelete(id)
}

/** Where will a save go right now? — for UI labelling. */
export function storageMode(): 'cloud' | 'local' {
  return isAuthed() ? 'cloud' : 'local'
}
