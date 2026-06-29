import { describe, it, expect } from 'vitest'
import { evaluate, hasNecessityGap, RULES } from './engine'
import type { RoomDesign, FurnitureItem, RoomType } from '../types'
import { ARCHETYPE_MAP } from '../data/archetypes'
import { toRoomDesign } from '../data/personas'
import { PERSONA_MAP } from '../data/personas'

let n = 0
function place(archetype: string, x = 100, z = 100): FurnitureItem {
  const a = ARCHETYPE_MAP[archetype]
  if (!a) throw new Error(`unknown archetype ${archetype}`)
  return {
    id: `f-${n++}`,
    archetype: a.id,
    category: a.category,
    name: a.name,
    x,
    z,
    rotation: 0,
    w: a.w,
    d: a.d,
    h: a.h,
    color: a.color,
  }
}

function room(furniture: FurnitureItem[], roomType: RoomType = 'living', genre?: string): RoomDesign {
  return {
    id: 'r',
    name: 'test',
    unit: 'cm',
    shape: 'rect',
    corners: [
      { x: 0, z: 0 },
      { x: 500, z: 0 },
      { x: 500, z: 400 },
      { x: 0, z: 400 },
    ],
    wallHeight: 270,
    wallThickness: 12,
    openings: [],
    materials: { wallColor: '#f4f1ea', floorTexture: 'natural-oak' },
    furniture,
    roomType,
    personaGenre: genre,
    createdAt: 0,
    updatedAt: 0,
  }
}

const ruleIds = (d: RoomDesign) => evaluate(d).map((s) => s.rule_id)

describe('necessity rules (R1-R3)', () => {
  it('R2 + R3: an empty living room has no seating and no light', () => {
    const ids = ruleIds(room([]))
    expect(ids).toContain('R2')
    expect(ids).toContain('R3')
  })

  it('R1: a bedroom with no bed suggests a bed', () => {
    const ids = ruleIds(room([place('decor-lamp')], 'bedroom'))
    expect(ids).toContain('R1')
  })

  it('R1 does NOT fire in a living room (no bed needed)', () => {
    const ids = ruleIds(room([place('sofa-3'), place('decor-lamp')], 'living'))
    expect(ids).not.toContain('R1')
  })

  it('R3 fires whenever there is no light, regardless of room type', () => {
    expect(ruleIds(room([place('sofa-3')], 'living'))).toContain('R3')
    expect(ruleIds(room([place('bed-queen')], 'bedroom'))).toContain('R3')
  })
})

describe('polish rules', () => {
  it('R4: seating present but no rug → polish suggestion', () => {
    const ids = ruleIds(room([place('sofa-3'), place('decor-lamp'), place('decor-lamp-table')]))
    expect(ids).toContain('R4')
  })

  it('R4 does NOT fire once a rug is present', () => {
    const ids = ruleIds(
      room([place('sofa-3'), place('decor-rug-large'), place('decor-lamp'), place('decor-lamp-table')]),
    )
    expect(ids).not.toContain('R4')
  })

  it('R5: exactly one light → suggest layering a second', () => {
    const ids = ruleIds(room([place('sofa-3'), place('decor-lamp'), place('decor-rug-large')]))
    expect(ids).toContain('R5')
  })

  it('R12: a bed with no nightstand → suggest one', () => {
    const ids = ruleIds(room([place('bed-queen'), place('decor-lamp')], 'bedroom'))
    expect(ids).toContain('R12')
  })
})

describe('prioritization: necessity ranks above polish', () => {
  it('necessity suggestions sort before polish suggestions', () => {
    // seating but no light (R3 necessity) + no rug (R4 polish)
    const sugg = evaluate(room([place('sofa-3')]))
    const firstPolish = sugg.findIndex((s) => s.tier === 'polish')
    const lastNecessity = sugg.map((s) => s.tier).lastIndexOf('necessity')
    expect(lastNecessity).toBeLessThan(firstPolish)
  })
})

describe('genre-aware rules', () => {
  it('gamer room with no desk fires the genre necessity rule', () => {
    const ids = ruleIds(room([place('chair-gaming'), place('decor-lamp')], 'office', 'gamer'))
    expect(ids).toContain('G-gamer-desk')
  })

  it('genre rules do NOT fire outside their genre', () => {
    const ids = ruleIds(room([place('sofa-3'), place('decor-lamp')], 'living'))
    expect(ids).not.toContain('G-gamer-desk')
    expect(ids).not.toContain('G-anime-shelf')
  })

  it('anime room with no display shelf fires G-anime-shelf', () => {
    const ids = ruleIds(room([place('bed-platform'), place('decor-lamp')], 'bedroom', 'anime_otaku'))
    expect(ids).toContain('G-anime-shelf')
  })
})

describe('all suggestions carry a valid one-tap Add (or are advisory-only)', () => {
  it('every suggest_archetype is a real corpus id or empty', () => {
    for (const r of RULES) {
      if (r.suggest_archetype) expect(ARCHETYPE_MAP[r.suggest_archetype]).toBeDefined()
    }
  })
})

describe('acceptance scenarios (brief §8)', () => {
  it('Anime/Otaku: delete the rug → a polish suggestion appears, no necessity gap', () => {
    const base = toRoomDesign(PERSONA_MAP['anime_otaku'])
    const noRug = { ...base, furniture: base.furniture.filter((f) => ARCHETYPE_MAP[f.archetype].model !== 'rug') }
    const sugg = evaluate(noRug)
    expect(sugg.some((s) => s.rule_id === 'R4' && s.tier === 'polish')).toBe(true)
    expect(hasNecessityGap(noRug)).toBe(false)
  })

  it('Anime/Otaku: delete all lighting → a higher-priority necessity suggestion appears', () => {
    const base = toRoomDesign(PERSONA_MAP['anime_otaku'])
    const noLight = { ...base, furniture: base.furniture.filter((f) => ARCHETYPE_MAP[f.archetype].model !== 'lamp') }
    const sugg = evaluate(noLight)
    expect(sugg.some((s) => s.rule_id === 'R3' && s.tier === 'necessity')).toBe(true)
    // necessity ranks first
    expect(sugg[0].tier).toBe('necessity')
  })

  it('Family with Kids: delete the rug → polish; delete lights → necessity', () => {
    const base = toRoomDesign(PERSONA_MAP['family'])
    const noRug = { ...base, furniture: base.furniture.filter((f) => ARCHETYPE_MAP[f.archetype].model !== 'rug') }
    expect(evaluate(noRug).some((s) => s.rule_id === 'R4')).toBe(true)
    const noLight = { ...base, furniture: base.furniture.filter((f) => ARCHETYPE_MAP[f.archetype].model !== 'lamp') }
    expect(evaluate(noLight).some((s) => s.rule_id === 'R3' && s.tier === 'necessity')).toBe(true)
  })
})
