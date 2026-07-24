// ApexSports QA — auth helpers (C0 harness)
// login.vue uses Ant Design Vue <a-input> with placeholders "用户名" / "密码"
// and an <a-button html-type="submit"> with text "登录". Semantic locators
// are preferred; falling back to placeholder + role keeps the smoke spec
// resilient against minor DOM tweaks.
import type { Page, BrowserContext } from '@playwright/test'

export const STORAGE_STATE_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/admin.storageState.json'

/**
 * Drives the login form on /login with the given credentials, then asserts
 * the SPA navigated to /dashboard. Throws on any deviation so the caller
 * (smoke spec / fixture setup) fails loudly.
 */
export async function login(
  page: Page,
  username: string = 'admin',
  password: string = 'admin123',
): Promise<void> {
  await page.goto('/login')

  // Ant Design Vue renders <input class="ant-input"> inside <a-input>; the
  // placeholder is the most stable selector. The password field is an
  // <a-input-password> which also surfaces an <input> with placeholder.
  await page.getByPlaceholder('用户名').fill(username)
  await page.getByPlaceholder('密码').fill(password)

  // Submit button: <a-button html-type="submit">Login</a-button>. Use role
  // + name so it survives class churn. Ant Design Vue auto-inserts a space
  // between adjacent CJK chars, so the rendered accessible name is "登 录"
  // rather than "登录". Use a regex that tolerates 0 or 1 whitespace char.
  await page.getByRole('button', { name: /登\s?录/ }).click()

  // SPA redirect — wait for the URL to leave /login. waitForURL gives
  // auto-waiting without arbitrary sleeps.
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}

/**
 * Persists the current browser context's cookies + localStorage to disk so
 * later module specs (C2-C14) can reuse the authenticated session via
 * `test.use({ storageState: STORAGE_STATE_PATH })`.
 */
export async function saveStorageState(context: BrowserContext): Promise<void> {
  await context.storageState({ path: STORAGE_STATE_PATH })
}
