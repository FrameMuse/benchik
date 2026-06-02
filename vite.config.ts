import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: ['bench.suite.ts'],
      formats: ['es'],
      fileName: () => 'bench.suite.js',
    },

    modulePreload: false,
    minify: false
  },
  plugins: [dts()],
})
