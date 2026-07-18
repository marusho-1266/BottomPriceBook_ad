import { defineConfig } from 'vitest/config';

// アカウント削除フローの E2E 検証。Firestore(8080) / Auth(9099) / Functions(5001)
// エミュレータがすべて起動していることが前提(`npm run emulators`)。
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
