import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Cross-island R3F components (e.g. /lighting, /rendering) are imported by the app. Force a SINGLE
  // copy of React / three / the R3F ecosystem so hook contexts match the app's <Canvas> — otherwise a
  // duplicate @react-three/fiber (from an island's own node_modules) throws "Hooks can only be used
  // within the Canvas component". No-op for islands that already resolve to root; required for any
  // island that ships its own R3F copy. (Added with Agent G's realism-layer mount.)
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'postprocessing',
      'three-stdlib',
      'three-mesh-bvh',
      'three-gpu-pathtracer',
      'zustand',
    ],
  },
  server: {
    host: true,
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:5181',
        changeOrigin: true,
      },
    },
  },
})
