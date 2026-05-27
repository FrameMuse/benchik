import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: ['bench.suite.ts', "./browser.html"],
      formats: ['es'],
      fileName: () => 'bench.suite.js',
    },
  },
  plugins: [dts()],
})
