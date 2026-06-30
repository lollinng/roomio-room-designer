// The post-processing pipeline — the EffectComposer that turns a flatly-rendered scene
// photographic. Mounts as a CHILD of the app's existing <Canvas shadows flat> (no Canvas-prop
// changes): `flat` keeps the renderer at NoToneMapping so this composer owns tone mapping exactly
// once (the v2 composer even force-sets NoToneMapping during its own render).
//
// Effect ORDER (top→bottom = render order):
//   1) N8AO        — ambient occlusion (soft contact darkening); off at "low", halfRes at medium.
//   2) Bloom       — selective glow on HDR-bright emitters only (luminanceThreshold ~1.0).
//   3) Exposure    — pre-tonemap linear exposure (G's compensation knob; doesn't touch E's lights).
//   4) ToneMapping — ACES_FILMIC, LAST. Maps linear HDR → filmic, outputs sRGB. No extra gamma pass.
//
// HalfFloat buffer (composer default) keeps everything linear-HDR until tone mapping, which is what
// makes the selective-bloom-by-luminance trick work. While a path-traced hero still accumulates,
// the whole composer is suspended (the tracer does GI/AO/soft-shadows/glow physically).

import * as THREE from 'three'
import { EffectComposer, N8AO, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useRender } from '../store'
import { Exposure } from './ExposureEffect'

const N8AO_QUALITY = {
  high: 'high',
  medium: 'medium',
  low: 'low',
} as const

export function RealismPost() {
  const settings = useRender((s) => s.settings)
  const heroActive = useRender((s) => s.heroActive)

  // Suspend the raster post pipeline while the path tracer renders (avoid double-process).
  if (heroActive) return null

  const { post, toneMapping, quality } = settings

  // Build the effect list conditionally (EffectComposer's children type rejects falsy nodes),
  // preserving order: AO → Bloom → Exposure → ToneMapping (last).
  const effects: JSX.Element[] = []
  if (post.ao.enabled) {
    effects.push(
      <N8AO
        key="ao"
        aoRadius={post.ao.radius}
        intensity={post.ao.intensity}
        distanceFalloff={1}
        quality={N8AO_QUALITY[quality]}
        halfRes={quality !== 'high'}
      />,
    )
  }
  if (post.bloom.enabled) {
    effects.push(
      <Bloom
        key="bloom"
        mipmapBlur
        intensity={post.bloom.strength}
        luminanceThreshold={post.bloom.threshold}
        luminanceSmoothing={0.15}
        radius={post.bloom.radius}
      />,
    )
  }
  effects.push(<Exposure key="exposure" exposure={toneMapping.exposure} />)
  effects.push(<ToneMapping key="tonemap" mode={ToneMappingMode.ACES_FILMIC} />)

  return (
    <EffectComposer
      multisampling={post.multisampling}
      frameBufferType={THREE.HalfFloatType}
      enableNormalPass={false}
    >
      {effects}
    </EffectComposer>
  )
}
