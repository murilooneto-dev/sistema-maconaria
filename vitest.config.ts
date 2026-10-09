import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    // Worktrees de outras branches ficam em .claude/ e .superpowers/ — sem
    // isso os testes delas rodam junto e mascaram o resultado desta branch.
    exclude: [...configDefaults.exclude, '.claude/**', '.superpowers/**'],
  },
})
