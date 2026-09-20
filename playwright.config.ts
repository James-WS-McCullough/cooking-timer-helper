import { defineConfig, devices } from '@playwright/test'

// End-to-end tests drive the real production build in headless Chrome.
// Quiet by default: dots for progress, details only for failures.
//   npm run test:e2e            run everything
//   npm run test:e2e -- --ui    watch it happen / debug
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  timeout: 60_000, // some tests play through an hour of kitchen time, tick by tick
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  quiet: !process.env.E2E_VERBOSE, // E2E_VERBOSE=1 to see the page's and tests' console output
  reporter: process.env.CI ? [['dot'], ['github']] : [['dot']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // A phone-sized, touch viewport, in the Chrome that's already installed
    // (locally and on GitHub's runners), so there is no browser download.
    ...devices['Pixel 7'],
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120_000,
  },
})
