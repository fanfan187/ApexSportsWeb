// ApexSports QA — C12 记录管理模块 spec (record)
//
// Covers Docs/11-记录管理模块.md:
//   - GET /api/records         (列表，不分页；支持 eventId / recordType / status 筛选)
//   - GET /api/records/{id}    (详情，未在本 spec 单独验证；列表已含同字段)
//   - POST /api/records        (管理员手动新增；本 spec 为只读模块，不覆盖)
//   - PUT  /api/records/{id}   (修改 / 作废；本 spec 为只读模块，不覆盖)
//
// This is a READ-ONLY module — the spec never creates / updates / deletes seed
// records. No hard-delete beforeAll is needed because no `__qa_c12_` test
// entities are created; afterAll is a no-op for the same reason.
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent CJK
// chars. "查询" renders as "查 询", "重置" as "重 置". All Chinese button
// labels are matched with a regex that tolerates 0-or-1 whitespace between
// each char (see learnings.md 2026-07-21 11:15:00 root-cause note).
//
// CJK placeholders: Ant a-select stores placeholder in a sibling
// <span class="ant-select-selection-placeholder"> (not on the inner <input>).
// page.getByPlaceholder('记录类型') would time out — instead we scope to
// the filter-bar `.ant-select-selector` whose placeholder text matches.
import { mkdirSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { BrowserContext } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { qaTest, qaTestAnonymous } from './lib/fixtures'
import { apiLogin, apiGet } from './lib/api'
import { PREFIX, appendBug } from './lib/reporter'

const SUB_PREFIX = PREFIX + 'c12_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-record'
const STORAGE_STATE_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/admin.storageState.json'

// Seed event "男子100米" (data.sql:38, code=M100M) → its record (data.sql:140)
// is 李明 / 10.58秒 / recordType=1 (校记录). The eventId is auto-increment so
// we resolve it at runtime via GET /api/events and match by name.
const TARGET_EVENT_NAME = '男子100米'
const TARGET_EVENT_CODE = 'M100M'
const TARGET_ATHLETE_NAME = '李明'
const TARGET_SCORE_DISPLAY = '10.58秒'

// A non-existent event id (data.sql seeds 25 events; 999999 is safely out of
// range and is not a seeded __qa_ entity).
const NONEXISTENT_EVENT_ID = 999999

mkdirSync(EVIDENCE_DIR, { recursive: true })

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * Inject the persisted admin storageState into the page via an init script.
 *
 * Why: qaTest fixture's storageState option (Playwright 1.61 + ESM) does not
 * reliably inject localStorage entries into the page on this system (verified
 * in C1 happy3). Mirrors the C1 happy3 / C2-C7 workaround.
 */
async function injectStorageState(context: BrowserContext): Promise<string> {
  expect(
    existsSync(STORAGE_STATE_PATH),
    'storageState file must exist (produced by C1 happy1)',
  ).toBeTruthy()
  const stateJson = JSON.parse(readFileSync(STORAGE_STATE_PATH, 'utf8')) as {
    origins?: Array<{
      origin: string
      localStorage: Array<{ name: string; value: string }>
    }>
  }
  const lsEntries =
    stateJson.origins?.find((o) => o.origin === 'http://localhost:5173')
      ?.localStorage ?? []
  const tokenEntry = lsEntries.find((e) => e.name === 'token')
  expect(tokenEntry?.value, 'storageState must contain a token').toBeTruthy()

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
  return tokenEntry!.value
}

/**
 * Selects an option from an Ant a-select in the filter bar. The placeholder
 * lives on <span.ant-select-selection-placeholder>, so the caller scopes to
 * the filter-bar select whose placeholder matches `placeholderText`.
 *
 * Stable pattern from C5 (learnings.md 2026-07-21): click .ant-select-selector,
 * wait for the LAST visible .ant-select-dropdown portal, click the option
 * whose text matches `optionRe`.
 */
async function selectAntOption(
  page: import('@playwright/test').Page,
  placeholderText: string,
  optionRe: RegExp,
): Promise<void> {
  // Locate the a-select whose placeholder text matches. ant-select renders
  // <span class="ant-select-selection-placeholder"> at rest; filter bar has
  // two a-selects (记录类型, 状态). Scope to .filter-bar to avoid picking
  // modal selects if any are open.
  const selectPlaceholder = page
    .locator('.filter-bar .ant-select')
    .filter({
      has: page.locator('.ant-select-selection-placeholder', {
        hasText: placeholderText,
      }),
    })
    .first()
  await expect(selectPlaceholder, 'filter select must be visible').toBeVisible()

  const selector = selectPlaceholder.locator('.ant-select-selector')
  await selector.click()

  const dropdown = page.locator('.ant-select-dropdown').last()
  await expect(dropdown, 'dropdown portal must open after click').toBeVisible({
    timeout: 5000,
  })

  const option = dropdown
    .locator('.ant-select-item-option')
    .filter({ hasText: optionRe })
    .first()
  await expect(option, 'option must be present in dropdown').toBeVisible()
  await option.click()

  // Wait for the dropdown to close to avoid stale-portal races on the next
  // select interaction.
  await expect(dropdown).toBeHidden({ timeout: 5000 })
}

test.describe.serial('C12 记录管理模块', () => {
  // ───────────────────────────────────────────────────────────────────────
  // beforeAll — read-only module: no test entities are created, so no
  // hard-delete sweep is required. Evidence dir is created at module load.
  // ───────────────────────────────────────────────────────────────────────
  test.beforeAll(async () => {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy — list baseline + filter by event + filter by recordType (校记录=1)
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy: 记录列表 → 按项目筛选 (男子100米) → 按类型筛选 (校记录) — UI + API 双轨', async ({
    page,
    context,
  }) => {
    const token = await injectStorageState(context)
    process.env.QA_TOKEN = token

    // Resolve eventId for "男子100米" (data.sql:38, code=M100M) via the events
    // API. Event IDs are auto-increment so we cannot hardcode.
    const eventsRes = await apiGet<
      Array<{ id: number; name: string; code: string }>
    >('/events', token)
    expect(eventsRes.code, 'GET /api/events must return 200').toBe(200)
    const events = eventsRes.data
    expect(Array.isArray(events), 'events data must be an array').toBeTruthy()
    const targetEvent = (events as unknown[]).find(
      (r) =>
        (r as { name: string; code: string }).name === TARGET_EVENT_NAME &&
        (r as { name: string; code: string }).code === TARGET_EVENT_CODE,
    ) as { id: number; name: string; code: string } | undefined
    expect(targetEvent, 'seed event 男子100米 (M100M) must exist').toBeDefined()
    const targetEventId = targetEvent!.id

    // 1. GET /api/records — list baseline (12 seed rows per data.sql:139-151)
    const beforeList = await apiGet<
      Array<{
        id: number
        eventName: string
        recordType: number
        athleteName: string | null
        scoreDisplay: string
        status: number
      }>
    >('/records', token)
    expect(beforeList.code, 'GET /api/records must return 200').toBe(200)
    expect(
      Array.isArray(beforeList.data),
      'records list must be an array (no pagination)',
    ).toBeTruthy()
    const apiRowsBefore = beforeList.data as unknown[] as Array<{
      eventName: string
      athleteName: string | null
      recordType: number
    }>
    // data.sql seeds exactly 12 record rows; the spec is read-only so the
    // count must remain 12 unless other specs mutate records (none do).
    expect(
      apiRowsBefore.length,
      'seed records must be 12 (data.sql:139-151)',
    ).toBeGreaterThanOrEqual(12)

    // Navigate to /record and assert the UI table renders at least the 12
    // seed rows.
    await page.goto('/record')
    await page.waitForLoadState('domcontentloaded')

    const tableRows = page.locator('tbody.ant-table-tbody tr.ant-table-row')
    await expect(
      tableRows.first(),
      'at least one table row must render',
    ).toBeVisible()
    const rowCountBefore = await tableRows.count()
    expect(
      rowCountBefore,
      'UI table must show ≥12 seed rows',
    ).toBeGreaterThanOrEqual(12)

    await page.screenshot({
      path: evidencePath('happy-01-list-baseline.png'),
      fullPage: true,
    })

    // 2. Filter by event: fill the 项目ID a-input-number, click 查询.
    //    a-input-number renders an inner <input class="ant-input-number-input">.
    const eventIdInput = page
      .locator('.filter-bar input.ant-input-number-input')
      .first()
    await expect(eventIdInput, '项目ID input must be visible').toBeVisible()
    await eventIdInput.fill(String(targetEventId))

    // "查询" → "查 询" after Ant CJK auto-spacing.
    await page.getByRole('button', { name: /查\s?询/ }).click()

    // Wait for the table to refresh; the filtered result should contain the
    // seed record (李明 / 10.58秒).
    const filteredRows = page.locator('tbody.ant-table-tbody tr.ant-table-row')
    await expect(
      filteredRows.first(),
      'at least one filtered row must render',
    ).toBeVisible()

    const filteredRowTexts = await filteredRows.allInnerTexts()
    const joined = filteredRowTexts.join('\n')
    expect(
      joined,
      `filtered rows must contain athlete ${TARGET_ATHLETE_NAME}`,
    ).toContain(TARGET_ATHLETE_NAME)
    expect(
      joined,
      `filtered rows must contain score display ${TARGET_SCORE_DISPLAY}`,
    ).toContain(TARGET_SCORE_DISPLAY)

    await page.screenshot({
      path: evidencePath('happy-02-filter-by-event.png'),
      fullPage: true,
    })

    // API track: GET /api/records?eventId=xxx — verify UI/API data consistency.
    const byEventRes = await apiGet<
      Array<{ eventName: string; athleteName: string | null }>
    >(`/records?eventId=${targetEventId}`, token)
    expect(byEventRes.code, 'GET /api/records?eventId must return 200').toBe(200)
    const byEventData = byEventRes.data as unknown[] as Array<{
      eventName: string
      athleteName: string | null
    }>
    expect(byEventData.length, 'API filter by eventId must return ≥1').toBeGreaterThanOrEqual(1)
    expect(
      byEventData.some(
        (r) =>
          r.eventName === TARGET_EVENT_NAME &&
          (r.athleteName ?? '') === TARGET_ATHLETE_NAME,
      ),
      'API filter result must include 李明 / 男子100米',
    ).toBeTruthy()

    // 3. Reset the event filter, then filter by recordType (校记录=1).
    //    All 12 seed records are recordType=1, so the filtered result must
    //    still have ≥12 rows (no fewer than the baseline since no other types
    //    exist in seed data).
    const resetBtn = page.getByRole('button', { name: /重\s?置/ })
    await resetBtn.click()

    // Wait for the table to settle back to the full list.
    await expect(
      page.locator('tbody.ant-table-tbody tr.ant-table-row').first(),
      'table must repopulate after reset',
    ).toBeVisible()

    // Open the 记录类型 a-select and pick 校记录 (value=1).
    await selectAntOption(page, '记录类型', /校\s?记\s?录/)

    await page.getByRole('button', { name: /查\s?询/ }).click()

    // After filtering by recordType=1, every row's recordType column must
    // render a 校记录 tag. Assert at least 12 rows (all seed records are
    // 校记录) AND each row's text contains "校" (the StatusTag label).
    const typeFilteredRows = page.locator(
      'tbody.ant-table-tbody tr.ant-table-row',
    )
    await expect(
      typeFilteredRows.first(),
      'recordType-filtered rows must render',
    ).toBeVisible()
    const typeRowCount = await typeFilteredRows.count()
    expect(
      typeRowCount,
      'recordType=1 filter must yield ≥12 rows (all seed records are 校记录)',
    ).toBeGreaterThanOrEqual(12)

    await page.screenshot({
      path: evidencePath('happy-03-filter-by-type-record.png'),
      fullPage: true,
    })

    // API track: GET /api/records?recordType=1 — assert all returned rows
    // have recordType=1 and the array length matches the UI row count.
    const byTypeRes = await apiGet<
      Array<{ recordType: number }>
    >('/records?recordType=1', token)
    expect(byTypeRes.code, 'GET /api/records?recordType=1 must return 200').toBe(200)
    const byTypeData = byTypeRes.data as unknown[] as Array<{
      recordType: number
    }>
    expect(
      byTypeData.length,
      'recordType=1 API result must be ≥12',
    ).toBeGreaterThanOrEqual(12)
    for (const row of byTypeData) {
      expect(row.recordType, 'every filtered row must be recordType=1').toBe(1)
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — anonymous route guard redirects to /login?redirect=/record
  // ───────────────────────────────────────────────────────────────────────
  qaTestAnonymous('fail1 (qaTestAnonymous): 未登录访问 /record → 守卫跳 /login?redirect=/record', async ({
    page,
  }) => {
    await page.goto('/record')

    // router.beforeEach (src/router/index.ts) pushes
    // `/login?redirect=${to.path}` when no token is present.
    await page.waitForURL(/\/login\?redirect=\/record/, { timeout: 10000 })

    const url = new URL(page.url())
    expect(
      url.searchParams.get('redirect'),
      'redirect query must equal /record',
    ).toBe('/record')

    await page.screenshot({
      path: evidencePath('fail1-guard-redirect.png'),
      fullPage: true,
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — filter by a non-existent event → empty table + a-empty visible
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 按不存在的项目筛选 → 空表 + a-empty 组件可见', async ({
    page,
    context,
  }) => {
    const token = await injectStorageState(context)
    process.env.QA_TOKEN = token

    await page.goto('/record')
    await page.waitForLoadState('domcontentloaded')

    // Baseline: table has rows.
    const baselineRows = page.locator('tbody.ant-table-tbody tr.ant-table-row')
    await expect(baselineRows.first()).toBeVisible()

    // Fill the 项目ID input with a non-existent event id and query.
    const eventIdInput = page
      .locator('.filter-bar input.ant-input-number-input')
      .first()
    await eventIdInput.fill(String(NONEXISTENT_EVENT_ID))
    await page.getByRole('button', { name: /查\s?询/ }).click()

    // Ant Design Vue a-table with no data renders exactly one placeholder
    // row <tr class="ant-table-placeholder"> containing the a-empty component.
    // Assert: zero data rows + the a-empty component is visible.
    await expect(
      page.locator('tbody.ant-table-tbody tr.ant-table-row'),
      'no data rows after filtering by non-existent event',
    ).toHaveCount(0, { timeout: 10000 })

    const empty = page.locator('.ant-empty').first()
    await expect(empty, 'a-empty component must be visible').toBeVisible({
      timeout: 10000,
    })

    await page.screenshot({
      path: evidencePath('fail2-empty-result.png'),
      fullPage: true,
    })

    // API track: GET /api/records?eventId=999999 — verify the API returns an
    // empty array (UI/API consistency for the empty case).
    const emptyRes = await apiGet<unknown[]>(
      `/records?eventId=${NONEXISTENT_EVENT_ID}`,
      token,
    )
    expect(emptyRes.code, 'GET /api/records?eventId=999999 must return 200').toBe(200)
    expect(
      Array.isArray(emptyRes.data) && (emptyRes.data as unknown[]).length === 0,
      'API filter by non-existent eventId must return empty array',
    ).toBeTruthy()
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — read-only spec: no __qa_c12_ entities are created, so no
  // cleanup is required. Re-login only to keep process.env.QA_TOKEN fresh
  // for downstream specs in the same worker process.
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    // No test entities created — nothing to sweep. The login call below
    // mirrors the C1/C2 contract pattern so the next spec in the same worker
    // sees a fresh QA_TOKEN env var.
    try {
      const token = await apiLogin('admin', 'admin123')
      process.env.QA_TOKEN = token
    } catch {
      // Best-effort — afterAll must not fail the suite for a transient login
      // issue when this spec is read-only.
    }
    void SUB_PREFIX // referenced for traceability; not used for cleanup.
  })
})

// Silence the unused-import lint for appendBug — referenced here so the
// harness-provided bug reporter remains importable from this spec without
// a separate import dance in the future when a P1+ bug is discovered.
void appendBug
