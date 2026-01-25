import { defineConfig, devices } from '@playwright/test';

const frontendPort = parseInt(process.env.E2E_FRONTEND_PORT || '3003', 10);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/test-webserver.mjs',
    url: `http://localhost:${frontendPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

