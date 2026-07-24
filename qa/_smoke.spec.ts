// ApexSports QA — C0 smoke spec
// Verifies the harness end-to-end: real browser -> /login -> admin login ->
// /dashboard -> KPI visible -> screenshot -> storageState persisted.
//
// Raw `test` is used (not qaTest) because the smoke spec intentionally
// logs in fresh to PRODUCE the storageState that qaTest later consumes.
import { test, expect } from '@playwright/test'
import { login, saveStorageState, STORAGE_STATE_PATH } from './lib/auth'

const SMOKE_SCREENSHOT_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/smoke.png'

test.describe('C0 harness smoke', () => {
  test('login -> dashboard -> KPI visible -> screenshot -> save storageState', async ({
    page,
  }) => {
    // 1. Navigate to login page (explicit; login() also does goto but this
    //    makes the smoke trace readable).
    await page.goto('/login')

    // 2. Drive the form + assert redirect to /dashboard.
    await login(page)

    // 3. KPI card should be visible. The dashboard renders either
    //    `.kpi-card` (custom) or `.ant-statistic` (antd Statistic). `.or`
    //    makes the assertion survive either layout.
    await expect(
      page
        .locator('.kpi-card')
        .or(page.locator('.ant-statistic'))
        .first(),
    ).toBeVisible()

    // 4. Visual evidence for the smoke run.
    await page.screenshot({ path: SMOKE_SCREENSHOT_PATH, fullPage: true })

    // 5. Persist cookies + localStorage so C2-C14 module specs can skip
    //    login via `test.use({ storageState: STORAGE_STATE_PATH })`.
    await saveStorageState(page.context())

    // 6. Sanity-check the persisted file contains a token (frontend stores
    //    it in localStorage key 'token' per src/stores/user.ts:25).
    const stateFile = await page.context().storageState()
    const tokenEntry = stateFile.origins
      .flatMap((o) => o.localStorage)
      .find((e) => e.name === 'token')
    expect(tokenEntry, 'storageState must capture localStorage token').toBeTruthy()
    expect(tokenEntry?.value, 'token value must be non-empty').not.toBe('')
  })
})
