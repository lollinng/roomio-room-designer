// The cross-agent layered-lighting predicate (Agent E <-> Agent A).
//
// A's suggestion engine derives the 'light' role from FURNITURE (model==='lamp')
// and fires "No light source" / "Only one light source — layer ambient+task+accent".
// E lights every room with real ambient + task (+accent) renderer lights, which are
// NOT lamp furniture. This pure predicate lets A's engine treat a room E lights as
// lit + layered, so it passes those rules out of the box.
//
// A: import this (or mirror it) and consult it before firing the light rules.

import type { Light } from './types'

export interface LightingSatisfaction {
  /** at least one enabled light that actually emits. */
  hasLight: boolean
  /** layered = >=1 task light AND an ambient fill (the single-overhead fix). */
  isLayered: boolean
  /** full three-layer coverage (ambient + task + accent). */
  isFullyLayered: boolean
  layers: { ambient: number; task: number; accent: number }
}

function emits(l: Light): boolean {
  return l.enabled !== false && l.intensity > 0
}

/** Evaluate a room's lights against A's lighting rules. */
export function roomLightingSatisfaction(lights: Light[] | undefined): LightingSatisfaction {
  const ls = (lights ?? []).filter(emits)
  const layers = { ambient: 0, task: 0, accent: 0 }
  for (const l of ls) layers[l.layer]++

  const hasLight = ls.length > 0
  const isLayered = layers.task >= 1 && layers.ambient >= 1
  const isFullyLayered = isLayered && layers.accent >= 1

  return { hasLight, isLayered, isFullyLayered, layers }
}
