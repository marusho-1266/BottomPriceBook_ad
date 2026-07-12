import { defineConfig } from 'vitest/config';

// セキュリティルールのテスト。Firebase エミュレータ(Firestore: 8080)の起動が前提。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
