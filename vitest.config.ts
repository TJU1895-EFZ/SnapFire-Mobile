import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@mobile': resolve(__dirname, 'src/mobile')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
