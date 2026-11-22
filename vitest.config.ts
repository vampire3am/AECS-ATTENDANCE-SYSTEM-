import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
config({ path: '.env.test', override: true, quiet: true });
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
