// ApexSports QA — Playwright test fixtures (C0 harness)
// qaTest: logged-in fixture (reuses admin.storageState.json produced by C0 smoke).
// qaTestAnonymous: fresh context with no storageState, for route-guard tests.
//
// STORAGE_STATE_PATH is an absolute path (mirrors lib/auth.ts) because the
// project ships as ESM ("type": "module"), where `__dirname` is undefined.
// An absolute forward-slash path works on Windows and is stable regardless
// of cwd.
import { test } from '@playwright/test'

export const STORAGE_STATE_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/admin.storageState.json'

export const qaTest = test.extend({})
qaTest.use({ storageState: STORAGE_STATE_PATH })

export const qaTestAnonymous = test.extend({})
qaTestAnonymous.use({ storageState: undefined })

// Re-export the base test object so specs can mix raw + extended if needed.
export { test, expect } from '@playwright/test'
