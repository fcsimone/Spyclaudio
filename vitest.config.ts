import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/unit/setup.ts'],
        },
      },
      {
        test: {
          name: 'rules',
          environment: 'node',
          globals: true,
          include: ['tests/rules/**/*.test.ts'],
          testTimeout: 20_000,
          hookTimeout: 20_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
