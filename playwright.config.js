import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  }
});
