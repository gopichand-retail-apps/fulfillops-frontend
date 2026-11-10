import { defineConfig, devices } from '@playwright/test'

const apiBaseUrl = 'http://127.0.0.1:5212/api/v1'
const unavailableApiBaseUrl = 'http://127.0.0.1:1/api/v1'
const isMock = process.env.VITE_IS_MOCK ?? 'true'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5203',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'PORT=5212 npm run start:dev',
      cwd: '../fulfillops-backend',
      url: 'http://127.0.0.1:5212/api/v1/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5203 --strictPort',
      url: 'http://127.0.0.1:5203',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: apiBaseUrl,
        VITE_IS_MOCK: isMock,
        VITE_MOCK_API_BASE_URL:
          process.env.VITE_MOCK_API_BASE_URL ?? (isMock === 'true' ? apiBaseUrl : unavailableApiBaseUrl),
        VITE_REAL_API_BASE_URL:
          process.env.VITE_REAL_API_BASE_URL ?? (isMock === 'false' ? apiBaseUrl : unavailableApiBaseUrl),
      },
    },
  ],
})
