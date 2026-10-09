import { defineConfig } from 'vitest/config'

// Rules tests need the Firestore emulator, so they run only via
// `npm run test:rules` and stay out of the plain `npm test`.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], fileParallelism: false },
})
