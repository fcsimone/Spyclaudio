import { defineConfig, devices } from '@playwright/test';

/**
 * Os fluxos essenciais são testados em viewport mobile.
 * Os testes online exigem os emuladores Firebase; use `npm run test:e2e:online`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/Spyclaudio/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'android-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone-safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'viewport-320',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/Spyclaudio/',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
