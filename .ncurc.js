import { defineConfig } from 'npm-check-updates'

export default defineConfig({
  dep: ['prod', 'dev', 'optional'],
  removeRange: true,
  reject: ['eslint'],
})
