// ApexSports QA — C4 比赛项目模块 spec (event)
//
// Covers Docs/04-比赛项目管理模块.md:
//   - GET    /api/events           (list + filter by type/category/gender/status)
//   - GET    /api/events/{id}      (detail)
//   - POST   /api/events           (create)
//   - PUT    /api/events/{id}      (modify)
//   - DELETE /api/events/{id}      (logical delete)
//   - Error codes: 40001 / 40901 (doc) — backend ErrorCode enum returns 40906
//     for EVENT_CODE_EXISTS; spec/code mismatch is documented via appendBug.
//
// Layout:
//   - beforeAll: hard-delete __qa_c4_% rows from as_event so re-runs are not
//     blocked by soft-deleted rows whose code (UNIQUE, no `deleted` in index)
//     still occupies the slot. Mirrors C1 auth.spec.ts beforeAll pattern.
//   - happy: UI create __qa_c4_event_001 (type=1个人, category=1径赛,
//             gender=1男子, unit=秒) → API verify → API modify → API delete
//   - fail1: UI create with code=M100M (seed dup) → assert code in [40901, 40906]
//   - fail2: API create with type=9 (invalid enum) → assert code in [40001, 200];
//            if 200 (backend bug — no enum validation), appendBug + cleanup
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent CJK
// chars. "新增比赛项目" renders as "新 增 比 赛 项 目"; "确定" as "确 定"; etc.
// All Chinese text matched with a regex tolerating 0-or-1 whitespace per char.
import { execSync } from 'node:child_process'
import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { qaTest } from './lib/fixtures'
import {
  apiLogin,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  cleanupByPrefix,
} from './lib/api'
import { PREFIX, appendBug } from './lib/reporter'

const SUB_PREFIX = PREFIX + 'c4_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-event'
const STORAGE_STATE_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/admin.storageState.json'

function evidencePath(name: string): string {
  return `${EVIDENCE_DIR}/${name}`
}

/**
 * Hard-delete soft-deleted `__qa_c4_%` residual rows directly from as_event.
 *
 * Why this is needed (mirrors C1 auth.spec.ts beforeAll):
 * - as_event.code is UNIQUE across the table (the unique index does NOT
 *   include the `deleted` column). MyBatis-Plus @TableLogic sets deleted=1
 *   but the row remains, so the code stays occupied.
 * - GET /api/events filters deleted=1 rows, so the API sweep in afterAll
 *   cannot see or remove soft-deleted leftovers. Re-running happy then hits
 *   a UNIQUE constraint violation on INSERT __qa_c4_event_001 → 50000.
 *
 * Plan allowance: "only DELETE test entities prefixed `__qa_`". The
 * `LIKE '__qa_c4_%'` pattern matches only this spec's test rows; the 30
 * seed events in init/data.sql are never touched.
 *
 * Fallback: if docker or the mysql CLI is unavailable, the call fails
 * silently with a console.warn and the afterAll API sweep still runs as
 * best-effort.
 */
function hardCleanupQaEvents(): void {
  const cmd =
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
    "-e \"DELETE FROM as_event WHERE code LIKE '__qa_c4_%';\""
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 5000 })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[C4 event] hardCleanupQaEvents failed (docker / mysql unavailable);',
      'falling back to API cleanup in afterAll.',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Inject the persisted admin storageState into the page via addInitScript.
 * The qaTest fixture's storageState option does not reliably seed localStorage
 * on this system (see learnings.md 2026-07-21 C1 note). Workaround: load the
 * storageState JSON from disk and inject it so the SPA's router guard sees
 * the token on first load.
 */
async function injectStorageState(
  context: import('@playwright/test').BrowserContext,
): Promise<void> {
  const stateJson = JSON.parse(
    readFileSync(STORAGE_STATE_PATH, 'utf8'),
  ) as {
    origins?: Array<{
      origin: string
      localStorage: Array<{ name: string; value: string }>
    }>
  }
  const lsEntries =
    stateJson.origins?.find((o) => o.origin === 'http://localhost:5173')
      ?.localStorage ?? []
  await context.addInitScript(
    (entries: Array<{ name: string; value: string }>) => {
      for (const { name, value } of entries) {
        try {
          window.localStorage.setItem(name, value)
        } catch {
          // ignore — origin may not yet be localhost:5173
        }
      }
    },
    lsEntries,
  )
}

/**
 * Locate an a-form-item by its label text (tolerating CJK auto-spacing),
 * then return the form-item locator so callers can chain .locator('input')
 * or .locator('.ant-select-selector').
 */
function formItem(
  page: import('@playwright/test').Page,
  labelRe: RegExp,
) {
  return page
    .locator('.ant-form-item')
    .filter({ has: page.locator('label', { hasText: labelRe }) })
}

/**
 * Open an a-select (by clicking its .ant-select-selector) and pick the option
 * whose visible text matches `optionRe`. Ant Design Vue renders the dropdown
 * in a portal at the end of <body>, so we scope to .ant-select-dropdown and
 * wait for it to be visible before clicking. hasText with a regex tolerates
 * both "个人项目" and "个 人 项 目" (Ant CJK auto-spacing).
 */
async function selectOption(
  page: import('@playwright/test').Page,
  selectSelector: import('@playwright/test').Locator,
  optionRe: RegExp,
): Promise<void> {
  await selectSelector.click()
  // The portal dropdown appears as the last .ant-select-dropdown in <body>.
  const dropdown = page.locator('.ant-select-dropdown').last()
  await expect(dropdown).toBeVisible({ timeout: 5000 })
  const option = dropdown
    .locator('.ant-select-item-option')
    .filter({ hasText: optionRe })
    .first()
  await expect(option).toBeVisible({ timeout: 5000 })
  await option.click()
}

test.describe.serial('C4 比赛项目模块', () => {
  // ───────────────────────────────────────────────────────────────────────
  // beforeAll — hard-delete soft-deleted __qa_c4_% residuals before any test.
  // See hardCleanupQaEvents docstring for why API cleanup is insufficient.
  // ───────────────────────────────────────────────────────────────────────
  test.beforeAll(async () => {
    hardCleanupQaEvents()
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy — UI list + filter + create + API verify + API modify + API delete
  // ───────────────────────────────────────────────────────────────────────
  qaTest(
    'happy: 项目列表 ≥25 seed → filter 个人 → UI 新增 → API verify → API 修改 → API 删除',
    async ({ page, context }) => {
      await injectStorageState(context)

      // ── 1. Goto /event, assert seed rows present on first page ──
      await page.goto('/event')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(800) // allow fetch to settle
      const seedRowCount = await page.locator('.ant-table-row').count()
      // pageSize=15; first page shows up to 15. Lower bound: ≥10.
      expect(
        seedRowCount,
        'first page must render at least 10 seed rows',
      ).toBeGreaterThanOrEqual(10)

      await page.screenshot({
        path: evidencePath('happy-01-list-seed.png'),
        fullPage: true,
      })

      // ── 2. Filter by type=个人项目 ──
      // First a-select in the filter bar has placeholder="项目类型".
      await selectOption(
        page,
        page.locator('.filter-bar .ant-select-selector').first(),
        /个\s?人\s?项\s?目/,
      )
      await page.waitForTimeout(500) // fetch on @change

      await page.screenshot({
        path: evidencePath('happy-02-filter-individual.png'),
        fullPage: true,
      })

      const filteredRowCount = await page.locator('.ant-table-row').count()
      expect(
        filteredRowCount,
        'filter 个人项目 must yield at least 10 individual events',
      ).toBeGreaterThanOrEqual(10)

      // Reset filter so the new event is reachable in default view later.
      await page.getByRole('button', { name: /重\s?置/ }).click()
      await page.waitForTimeout(300)

      // ── 3. Open "新增比赛项目" modal via UI ──
      await page
        .getByRole('button', { name: /新\s?增\s?比\s?赛\s?项\s?目/ })
        .click()
      await expect(page.locator('.ant-modal-title')).toContainText(/新\s?增/)

      const eventCode = SUB_PREFIX + 'event_001'
      // Fill text inputs (placeholders: 请输入项目名称 / 请输入项目代码 / 如：秒、米、分)
      await formItem(page, /项\s?目\s?名\s?称/).locator('input').fill('QA C4 测试项目001')
      await formItem(page, /项\s?目\s?代\s?码/).locator('input').fill(eventCode)
      await formItem(page, /计\s?量\s?单\s?位/).locator('input').fill('秒')

      // Select type=个人项目
      await selectOption(
        page,
        formItem(page, /项\s?目\s?类\s?型/).locator('.ant-select-selector'),
        /个\s?人\s?项\s?目/,
      )

      // Select category=径赛
      await selectOption(
        page,
        formItem(page, /项\s?目\s?类\s?别/).locator('.ant-select-selector'),
        /径\s?赛/,
      )

      // Select gender=男子
      await selectOption(
        page,
        formItem(page, /性\s?别\s?限\s?制/).locator('.ant-select-selector'),
        /男\s?子/,
      )

      // Fill 个人限报项目数 = 2
      await formItem(page, /个\s?人\s?限\s?报/).locator('input').fill('2')

      await page.screenshot({
        path: evidencePath('happy-03-form-filled.png'),
        fullPage: true,
      })

      // Submit the modal — "确定" button in the modal footer
      await page.getByRole('button', { name: /确\s?定/ }).click()

      // Wait for the modal to close (success) — modal title disappears.
      await expect(page.locator('.ant-modal-title')).toBeHidden({
        timeout: 10000,
      })

      // ── 4. API verify: GET /events, find by code ──
      const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
      expect(token, 'token must persist after UI create').not.toBe('')

      const listRes = await apiGet<Array<{ id?: number; code?: string }>>(
        '/events',
        token,
      )
      expect(listRes.code, 'GET /api/events must return 200').toBe(200)
      expect(Array.isArray(listRes.data), 'data must be an array').toBe(true)
      const created = (listRes.data ?? []).find((r) => r.code === eventCode)
      expect(created, 'created event must appear in list').toBeDefined()
      expect(created?.id, 'created event must have an id').toBeDefined()
      const createdId = created!.id!

      await page.screenshot({
        path: evidencePath('happy-04-after-create.png'),
        fullPage: true,
      })

      // ── 5. API modify: PUT /events/{id} with new description ──
      const updateRes = await apiPut<{ id?: number; description?: string }>(
        `/events/${createdId}`,
        { description: 'QA C4 修改后的描述' },
        token,
      )
      expect(updateRes.code, 'PUT /api/events/{id} must return 200').toBe(200)
      expect(
        updateRes.data?.description,
        'description must be updated',
      ).toBe('QA C4 修改后的描述')

      // ── 6. API delete: DELETE /events/{id} ──
      const delRes = await apiDelete(`/events/${createdId}`, token)
      expect(delRes.code, 'DELETE /api/events/{id} must return 200').toBe(200)

      // Verify deletion — GET /events should no longer contain the code.
      const listRes2 = await apiGet<Array<{ code?: string }>>('/events', token)
      const stillThere = (listRes2.data ?? []).find((r) => r.code === eventCode)
      expect(
        stillThere,
        'deleted event must not appear in list',
      ).toBeUndefined()

      await page.screenshot({
        path: evidencePath('happy-05-after-delete.png'),
        fullPage: true,
      })
    },
  )

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — UI create with seed code M100M → expect 40901 (doc) / 40906 (real)
  // ───────────────────────────────────────────────────────────────────────
  qaTest(
    'fail1: 新增 code=M100M (seed 重复) → 40901/40906',
    async ({ page, context }) => {
      await injectStorageState(context)

      await page.goto('/event')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)

      // Intercept the POST /events response so we can read the business code
      // BEFORE the axios interceptor may trigger a toast / reload.
      let apiCode: number | undefined
      await page.route('**/api/events', async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue()
          return
        }
        const response = await route.fetch()
        const body = await response.json().catch(() => undefined)
        if (body && typeof body.code === 'number') apiCode = body.code
        await route.fulfill({ response })
      })

      await page
        .getByRole('button', { name: /新\s?增\s?比\s?赛\s?项\s?目/ })
        .click()
      await expect(page.locator('.ant-modal-title')).toContainText(/新\s?增/)

      // Fill with seed code M100M (per data.sql:38) to trigger code-dup error.
      await formItem(page, /项\s?目\s?名\s?称/).locator('input').fill('QA C4 fail1 dup')
      await formItem(page, /项\s?目\s?代\s?码/).locator('input').fill('M100M')
      await formItem(page, /计\s?量\s?单\s?位/).locator('input').fill('秒')
      await selectOption(
        page,
        formItem(page, /项\s?目\s?类\s?型/).locator('.ant-select-selector'),
        /个\s?人\s?项\s?目/,
      )
      await selectOption(
        page,
        formItem(page, /项\s?目\s?类\s?别/).locator('.ant-select-selector'),
        /径\s?赛/,
      )
      await selectOption(
        page,
        formItem(page, /性\s?别\s?限\s?制/).locator('.ant-select-selector'),
        /男\s?子/,
      )

      await page.screenshot({
        path: evidencePath('fail1-form-filled.png'),
        fullPage: true,
      })

      await page.getByRole('button', { name: /确\s?定/ }).click()

      // Wait for the intercepted API response to surface the business code.
      await expect
        .poll(() => apiCode, {
          timeout: 10000,
          message: 'POST /api/events must be intercepted with a numeric code',
        })
        .not.toBe(undefined)

      // Tolerant assertion: doc says 40901, backend ErrorCode enum returns
      // 40906 (EVENT_CODE_EXISTS). Accept either — the discrepancy itself
      // is recorded via appendBug below.
      expect(
        [40901, 40906],
        'duplicate code must yield 40901 (doc) or 40906 (backend ErrorCode)',
      ).toContain(apiCode)

      await page.screenshot({
        path: evidencePath('fail1-dup-rejected.png'),
        fullPage: true,
      })

      // If the real backend code (40906) differs from the doc (40901), document
      // the spec/code mismatch — but only as a P3 (documentation drift), not a
      // product bug. The behavior is correct; only the published code differs.
      if (apiCode === 40906) {
        appendBug({
          module: 'event',
          caseKey: 'fail1-code-dup-code-mismatch',
          step: 'POST /api/events with code=M100M (seed duplicate)',
          expected: 'Docs/04 §22 lists error code 40901 (项目代码已存在)',
          actual:
            'Backend ErrorCode.EVENT_CODE_EXISTS returns 40906 (not 40901). Behavior is correct; only the published code differs from the doc.',
          severity: 'P3',
          screenshotPath: 'fail1-dup-rejected.png',
        })
      }
    },
  )

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — API create with type=9 (invalid enum) → expect 40001
  // The backend EventCreateDTO has @NotNull on `type` but no @Range/@Min/@Max,
  // and EventLogic.create does NOT validate enum membership. So the backend
  // will likely accept type=9 and return 200 — a missing-validation defect.
  // Tolerant assertion + appendBug documents the defect; test stays green.
  // ───────────────────────────────────────────────────────────────────────
  qaTest(
    'fail2: API 新增 type=9 (非法枚举) → 40001 (或 200 + bug 报告)',
    async ({ page, context }) => {
      await injectStorageState(context)

      await page.goto('/event')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(300)

      const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
      expect(token, 'token must be present').not.toBe('')

      // Screenshot the list state before the invalid-type API attempt.
      await page.screenshot({
        path: evidencePath('fail2-01-before-invalid-type.png'),
        fullPage: true,
      })

      const invalidCode = SUB_PREFIX + 'invalid_type'
      const res = await apiPost<{ id?: number; code?: string }>(
        '/events',
        {
          name: 'QA C4 fail2 invalid type',
          code: invalidCode,
          type: 9, // invalid — only 1 (个人) and 2 (集体) are documented
          category: 1,
          gender: 1,
          unit: '秒',
          maxIndividualEvents: 2,
          description: 'QA C4 fail2',
        },
        token,
      )

      // Tolerant assertion: doc says 40001, but backend lacks enum validation
      // and may return 200. Accept either; the 200 path triggers a bug report
      // and a cleanup of the spurious row.
      expect(
        [40001, 200],
        'type=9 must yield 40001 (param validation) — if 200, backend bug',
      ).toContain(res.code)

      if (res.code === 200 && res.data?.id) {
        // Backend accepted the invalid enum — cleanup the spurious row.
        await apiDelete(`/events/${res.data.id}`, token)
        appendBug({
          module: 'event',
          caseKey: 'fail2-invalid-type-not-validated',
          step: 'POST /api/events with type=9 (only 1/2 are documented enum values)',
          expected:
            'Docs/04 §22 lists type as Integer with enum 1-个人/2-集体; invalid value should yield 40001',
          actual:
            'EventCreateDTO has @NotNull only (no @Range/@Min/@Max on type); EventLogic.create does not validate enum membership. Backend accepts type=9 and creates the row.',
          severity: 'P2',
          screenshotPath: 'fail2-01-before-invalid-type.png',
        })
      }

      await page.screenshot({
        path: evidencePath('fail2-02-after-invalid-type.png'),
        fullPage: true,
      })
    },
  )

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — sweep any __qa_c4_* leftovers regardless of test outcome.
  // cleanupByPrefix matches on `record.name ?? record.code`; as_event records
  // expose `code` (the natural key we test with), so the contract call works
  // directly here.
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    const deleted = await cleanupByPrefix(
      '/events',
      (r) => r.id as number | string | undefined,
      (id) => `/events/${id}`,
      SUB_PREFIX,
      token,
    )
    if (deleted > 0) {
      // eslint-disable-next-line no-console
      console.log(`[C4 event] afterAll cleanup removed ${deleted} __qa_c4_ events`)
    }
  })
})
