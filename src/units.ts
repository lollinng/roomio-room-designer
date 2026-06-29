// Canonical internal unit is CENTIMETERS. World/3D unit is METERS (cm / 100).
export type Unit = 'ft' | 'cm'

export const CM_PER_M = 100
export const CM_PER_IN = 2.54
export const CM_PER_FT = 30.48

export const toM = (cm: number): number => cm / CM_PER_M
export const toCm = (m: number): number => m * CM_PER_M

/** Format a length in cm to a human string in the chosen unit. */
export function formatLen(cm: number, unit: Unit): string {
  if (unit === 'cm') {
    return `${Math.round(cm)} cm`
  }
  // feet + inches, e.g. 19' 8"
  const totalIn = cm / CM_PER_IN
  let ft = Math.floor(totalIn / 12)
  let inch = Math.round(totalIn - ft * 12)
  if (inch === 12) {
    ft += 1
    inch = 0
  }
  return `${ft}' ${inch}"`
}

/** Compact label (no unit suffix) used on small dimension tags. */
export function formatLenShort(cm: number, unit: Unit): string {
  if (unit === 'cm') return `${Math.round(cm)}`
  const totalIn = cm / CM_PER_IN
  let ft = Math.floor(totalIn / 12)
  let inch = Math.round(totalIn - ft * 12)
  if (inch === 12) {
    ft += 1
    inch = 0
  }
  return `${ft}' ${inch}"`
}

/**
 * Parse a user-typed length string into cm.
 * Accepts: "350" (cm if unit=cm), "11' 6\"", "11ft 6in", "11.5'", "350cm", "3.5m".
 * Returns null if unparseable.
 */
export function parseLen(input: string, unit: Unit): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null

  // explicit cm / m
  let m = s.match(/^([\d.]+)\s*cm$/)
  if (m) return parseFloat(m[1])
  m = s.match(/^([\d.]+)\s*m$/)
  if (m) return parseFloat(m[1]) * CM_PER_M

  // feet+inches: 11' 6", 11ft 6in, 11'6, 11 6
  m = s.match(/^([\d.]+)\s*(?:'|ft|feet|f)\s*([\d.]+)?\s*(?:"|in|inch|inches)?$/)
  if (m) {
    const ft = parseFloat(m[1])
    const inch = m[2] ? parseFloat(m[2]) : 0
    return (ft * 12 + inch) * CM_PER_IN
  }
  // inches only: 24"
  m = s.match(/^([\d.]+)\s*(?:"|in|inch|inches)$/)
  if (m) return parseFloat(m[1]) * CM_PER_IN

  // bare number → interpret in current unit
  m = s.match(/^([\d.]+)$/)
  if (m) {
    const n = parseFloat(m[1])
    return unit === 'cm' ? n : n * CM_PER_FT // bare number in ft mode = feet
  }
  return null
}
