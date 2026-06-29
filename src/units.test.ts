import { describe, it, expect } from 'vitest'
import {
  formatLen,
  formatLenShort,
  parseLen,
  toM,
  toCm,
  CM_PER_M,
  CM_PER_FT,
  CM_PER_IN,
} from './units'

// ---------------------------------------------------------------------------
// toM / toCm
// ---------------------------------------------------------------------------

describe('toM / toCm', () => {
  it('convert between cm and m', () => {
    expect(toM(350)).toBeCloseTo(3.5, 9)
    expect(toCm(3.5)).toBeCloseTo(350, 9)
  })

  it('are inverses of each other', () => {
    for (const cm of [0, 1, 12, 350, 1234.5]) {
      expect(toCm(toM(cm))).toBeCloseTo(cm, 9)
    }
    for (const m of [0.1, 2.7, 9.99]) {
      expect(toM(toCm(m))).toBeCloseTo(m, 9)
    }
  })

  it('CM_PER_M constant is 100', () => {
    expect(CM_PER_M).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// formatLen / formatLenShort
// ---------------------------------------------------------------------------

describe('formatLen', () => {
  it('formats cm with a rounded value and unit suffix', () => {
    expect(formatLen(350, 'cm')).toBe('350 cm')
    expect(formatLen(350.4, 'cm')).toBe('350 cm')
    expect(formatLen(350.6, 'cm')).toBe('351 cm')
  })

  it('formats ft as feet and inches', () => {
    // 350 cm / 2.54 = 137.795 in = 11 ft 5.795 in → 11' 6"
    expect(formatLen(350, 'ft')).toBe(`11' 6"`)
    // Exactly 12 ft = 365.76 cm
    expect(formatLen(12 * CM_PER_FT, 'ft')).toBe(`12' 0"`)
  })

  it('rolls 12 inches up into the next foot', () => {
    // A length whose inch part rounds to 12 must become +1 ft, 0 in.
    // 11 ft 11.6 in → rounds to 12 in → 12' 0".
    const cm = (11 * 12 + 11.6) * CM_PER_IN
    expect(formatLen(cm, 'ft')).toBe(`12' 0"`)
  })
})

describe('formatLenShort', () => {
  it('omits the unit suffix in cm mode', () => {
    expect(formatLenShort(350, 'cm')).toBe('350')
  })

  it('matches the feet+inches form in ft mode', () => {
    expect(formatLenShort(350, 'ft')).toBe(`11' 6"`)
  })
})

// ---------------------------------------------------------------------------
// parseLen
// ---------------------------------------------------------------------------

describe('parseLen', () => {
  it('parses explicit cm', () => {
    expect(parseLen('350cm', 'ft')).toBeCloseTo(350, 6)
    expect(parseLen('350 cm', 'cm')).toBeCloseTo(350, 6)
  })

  it('parses explicit m', () => {
    expect(parseLen('3.5m', 'ft')).toBeCloseTo(350, 6)
    expect(parseLen('3.5 m', 'cm')).toBeCloseTo(350, 6)
  })

  it("parses feet+inches like \"11' 6\\\"\"", () => {
    expect(parseLen(`11' 6"`, 'ft')).toBeCloseTo((11 * 12 + 6) * CM_PER_IN, 6)
    expect(parseLen('11ft 6in', 'ft')).toBeCloseTo((11 * 12 + 6) * CM_PER_IN, 6)
    expect(parseLen('11.5\'', 'ft')).toBeCloseTo(11.5 * 12 * CM_PER_IN, 6)
  })

  it('parses inches only', () => {
    expect(parseLen('24"', 'ft')).toBeCloseTo(24 * CM_PER_IN, 6)
  })

  it('parses bare numbers in the current unit', () => {
    // cm mode: bare number is cm.
    expect(parseLen('350', 'cm')).toBeCloseTo(350, 6)
    // ft mode: bare number is feet.
    expect(parseLen('11', 'ft')).toBeCloseTo(11 * CM_PER_FT, 6)
  })

  it('round-trips through formatLen (cm)', () => {
    const cm = 350
    const formatted = formatLen(cm, 'cm') // "350 cm"
    expect(parseLen(formatted, 'cm')).toBeCloseTo(cm, 6)
  })

  it('round-trips a feet+inches string back to ≈ the original cm', () => {
    const cm = (11 * 12 + 6) * CM_PER_IN // exactly 11' 6"
    const formatted = formatLen(cm, 'ft') // "11' 6\""
    const parsed = parseLen(formatted, 'ft')
    expect(parsed).not.toBeNull()
    // Round-trip through integer-inch formatting: within half an inch.
    expect(parsed!).toBeCloseTo(cm, 1)
  })

  it('returns null for garbage', () => {
    expect(parseLen('', 'cm')).toBeNull()
    expect(parseLen('   ', 'cm')).toBeNull()
    expect(parseLen('abc', 'cm')).toBeNull()
    expect(parseLen('twelve', 'ft')).toBeNull()
    expect(parseLen('12 bananas', 'cm')).toBeNull()
  })
})
