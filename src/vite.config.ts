import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import '@rollup/plugin-node-resolve'
import '@rollup/plugin-commonjs'

// https://vitejs.dev/config/
// @ts-ignore
// @ts-ignore
export default defineConfig({
  build:{
    lib:{
      entry: './deferred-response-handler/web-component-to-image-builder/web-components/svelte/src/main.ts',
      name: 'LiveStandings',
    },
    outDir: './deferred-response-handler/web-component-to-image-builder/web-components/svelte/dist',
    rollupOptions: {
      output: [
        {
          format: 'esm',
          entryFileNames: 'live-standings-web-component.js'
        },
        {
          format: 'iife',
          name: 'live-standings.js'
        }
      ]
    }
  },
  plugins: [svelte({
    compilerOptions: {
      customElement: true,
    }
  })],
})
