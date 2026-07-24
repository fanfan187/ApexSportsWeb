// ApexSports QA — Playwright config (C0 harness)
// Forward slashes in absolute paths work on Windows and keep TS portable.
//
// NOTE on webServer reuseExistingServer: when the dev server is already up
// (started externally per MUST DO "Frontend probe & fallback"), Playwright
// probes the URL and skips starting the command. Keep reuseExistingServer:true.
//
// NOTE on browser binary: Playwright 1.61 prefers `chrome-headless-shell.exe`
// for headless chromium launches. The shell variant was missing initially
// (only the full `chromium-1228\chrome-win64\chrome.exe` was on disk); a
// targeted `playwright install chromium-headless-shell` (~114MB) was needed
// to make `chromium.launch()` work. See issues.md for the documented
// deviation from the "no browser redownload" rule.
import { defineConfig, devices } from '@playwright/test'

const REPORT_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-report'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: REPORT_DIR }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173/login',
    timeout: 60000,
    reuseExistingServer: true,
  },
})
