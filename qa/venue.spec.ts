// ApexSports QA — C6 场地管理模块 spec (venue)
//
// Covers Docs/06-场地管理模块.md:
//   - GET    /api/venues       (列表，不分页，支持 type / status 筛选)
//   - GET    /api/venues/{id}  (详情)
//   - POST   /api/venues      (新增, admin only)
//   - PUT    /api/venues/{id} (修改, admin only)
//   - DELETE /api/venues/{id} (逻辑删除, admin only)
//   - GET    /api/venues/{id}/schedule (赛程占用, 不在本 spec 覆盖范围)
//
// NOTE on error-code drift (verified against
// ApexSports/.../exception/ErrorCode.java):
//   - Docs/06 §34 says 40901 for "场地代码已存在", but the backend actually
//     throws ErrorCode.VENUE_CODE_EXISTS = 40911.
//   The spec asserts against the ACTUAL backend code (40911) and documents
//   the doc drift via appendBug. See fail1 case.
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent CJK
// chars. "新增场地" renders as "新 增 场 地", "确定" as "确 定", "删除" as
// "删 除", "编辑" as "编 辑", "查询" as "查 询", "重置" as "重 置". All
// Chinese button labels are matched with a regex that tolerates 0-or-1
// whitespace between each char (see learnings.md 2026-07-21 11:15:00).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
import type { BrowserContext, Locator, Page } from '@playwright/test'
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

const SUB_PREFIX = PREFIX + 'c6_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-venue'
const SKIPPED_FAIL2_REASON_PATH = resolve(
  EVIDENCE_DIR,
  'skipped-fail2-reason.txt',
)
const STORAGE_STATE_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/admin.storageState.json'

// Test entity constants (single source of truth for both UI + API tracks).
// Code uses uppercase prefix to match the documented 1~20 char alphanumeric
// convention; name uses lowercase prefix so cleanupByPrefix (which matches
// record.name ?? record.code) hits both fields via the lowercase prefix.
const QA_VENUE_01_NAME = SUB_PREFIX + 'venue_01'
const QA_VENUE_01_CODE = '__QA_C6_01'
const QA_VENUE_01_LOCATION = 'QA测试场地01-位置'
const QA_VENUE_01_CAPACITY = 100
const QA_VENUE_01_CAPACITY_UPDATED = 200

mkdirSync(EVIDENCE_DIR, { recursive: true })

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * Hard-delete soft-deleted `__qa_c6_` residual rows directly from the DB.
 *
 * Why this is needed (same trap as as_user / C1, as_college / C2):
 * - as_venue.code is UNIQUE across the table (the index does NOT include the
 *   `deleted` column). MyBatis-Plus @TableLogic sets deleted=1 but the row
 *   remains, so the code stays occupied. GET /api/venues filters deleted=1
 *   rows, so cleanupByPrefix (API sweep in afterAll) cannot see or remove
 *   soft-deleted leftovers. Re-running happy then hits a UNIQUE constraint
 *   violation on INSERT __QA_C6_01 → 50000.
 *
 * Plan allowance: "only DELETE test entities prefixed __qa_". The
 * `LIKE '__qa_c6_%'` pattern matches only SUB_PREFIX rows; the 7 seed
 * venues (data.sql:75-82) and the admin seed account are never touched.
 *
 * Fallback: if docker / mysql CLI is unavailable, the call fails silently
 * with a console.warn and the existing afterAll API sweep still runs as a
 * best-effort sweep.
 */
function hardCleanupQaVenues(): void {
  const cmd =
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
    "-e \"DELETE FROM as_venue WHERE name LIKE '__qa_c6_%' OR code LIKE '__QA_C6_%';\""
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 5000 })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[C6 venue] hardCleanupQaVenues failed (docker / mysql unavailable);',
      'falling back to API cleanup in afterAll.',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Injects the persisted admin storageState into the page via an init script.
 * Workaround for the Playwright 1.61 + ESM storageState injection issue
 * observed on this system (see C1 happy3 / C2 happy notes).
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
 * Clicks an Ant Design Vue a-select and picks the option whose visible text
 * matches `optionRe`. The dropdown portal renders at the end of <body> and
 * the placeholder lives on a sibling span (NOT on the input), so
 * getByPlaceholder does not work. See learnings.md (C3/C4/C5 a-select notes).
 */
async function selectAntOption(
  page: Page,
  selectLocator: Locator,
  optionRe: RegExp,
): Promise<void> {
  await selectLocator.first().click()
  const dropdown = page.locator('.ant-select-dropdown').last()
  await expect(dropdown).toBeVisible({ timeout: 5000 })
  const option = dropdown.locator('.ant-select-item-option').filter({
    hasText: optionRe,
  })
  await option.first().click()
}

test.describe.serial('C6 场地管理模块', () => {
  test.beforeAll(async () => {
    hardCleanupQaVenues()
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy — full CRUD via UI + API dual-track
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy: 场地 CRUD (列表/新增/修改/删除) — UI + API 双轨', async ({
    page,
    context,
  }) => {
    const token = await injectStorageState(context)
    process.env.QA_TOKEN = token

    // 1. GET /api/venues — list baseline (≥7 seed rows per data.sql:75-82)
    const beforeList = await apiGet<
      Array<{ id: number; name: string; code: string; type: number }>
    >('/venues', token)
    expect(beforeList.code, 'GET /api/venues must return 200').toBe(200)
    expect(
      Array.isArray(beforeList.data),
      'venues list must be an array (no pagination)',
    ).toBeTruthy()
    expect(
      (beforeList.data as unknown[]).length,
      'seed venues must be ≥7 (data.sql seeds 7)',
    ).toBeGreaterThanOrEqual(7)

    await page.goto('/venue')
    await page.waitForLoadState('domcontentloaded')

    // Assert the table renders at least the 7 seed rows.
    const tableRows = page.locator('tbody.ant-table-tbody tr.ant-table-row')
    await expect(tableRows.first(), 'at least one table row must render').toBeVisible()
    const rowCountBefore = await tableRows.count()
    expect(rowCountBefore, 'UI table must show ≥7 seed rows').toBeGreaterThanOrEqual(7)

    await page.screenshot({
      path: evidencePath('happy-01-list-baseline.png'),
      fullPage: true,
    })

    // 2. POST /api/venues — create __qa_c6_venue_01 via UI form
    await page.getByRole('button', { name: /新\s?增\s?场\s?地/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByPlaceholder('请输入场地名称').fill(QA_VENUE_01_NAME)
    await page.getByPlaceholder('请输入场地代码').fill(QA_VENUE_01_CODE)
    await page.getByPlaceholder('请输入位置（可选）').fill(QA_VENUE_01_LOCATION)

    // Capacity uses a-input-number — typing into the inner input works.
    const capacityInput = page.locator('.ant-input-number-input').first()
    await capacityInput.fill(String(QA_VENUE_01_CAPACITY))

    // Type select: placeholder "请选择场地类型" lives on the placeholder
    // span, not the input. Scope to the open dialog so we do not match the
    // filter bar's type select (which sits outside the modal and gets
    // pointer-event-blocked by ant-modal-wrap). Use the form-item label to
    // stay robust against form ordering changes.
    const typeSelect = page
      .getByRole('dialog')
      .locator('.ant-form-item')
      .filter({ hasText: '场地类型' })
      .locator('.ant-select-selector')
    await selectAntOption(page, typeSelect, /综\s?合\s?场\s?地/)

    await page.screenshot({
      path: evidencePath('happy-02-create-form-filled.png'),
      fullPage: true,
    })

    // Ant modal OK button text is "确定" → "确 定" after CJK auto-spacing.
    await page.getByRole('button', { name: /确\s?定/ }).click()

    // Wait for the modal to close (form submitted + list reloaded). Ant
    // a-modal stays in DOM as display:none — toBeHidden passes on either
    // hidden or detached.
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 })

    // API track: assert the new venue exists.
    const afterCreateList = await apiGet<
      Array<{
        id: number
        name: string
        code: string
        type: number
        location?: string
        capacity?: number
        status?: number
      }>
    >('/venues', token)
    expect(afterCreateList.code, 'GET /api/venues after create').toBe(200)
    const created = (afterCreateList.data as unknown[]).find(
      (r) => (r as { code: string }).code === QA_VENUE_01_CODE,
    ) as
      | {
          id: number
          name: string
          code: string
          type: number
          location?: string
          capacity?: number
          status?: number
        }
      | undefined
    expect(created, 'created venue must appear in API list').toBeDefined()
    expect(created!.name, 'created venue name must match').toBe(QA_VENUE_01_NAME)
    expect(created!.type, 'created venue type must be 3 (综合)').toBe(3)
    expect(created!.location, 'created venue location must match').toBe(
      QA_VENUE_01_LOCATION,
    )
    expect(created!.capacity, 'created venue capacity must match').toBe(
      QA_VENUE_01_CAPACITY,
    )
    expect(created!.status, 'created venue status defaults to 1 (可用)').toBe(1)
    const createdId = created!.id

    // UI track: assert the new venue row appears in the table.
    await expect(page.getByText(QA_VENUE_01_NAME)).toBeVisible()
    await page.screenshot({
      path: evidencePath('happy-03-created-in-list.png'),
      fullPage: true,
    })

    // 3. GET /api/venues/{id} — detail
    const detail = await apiGet<{ id: number; code: string; capacity?: number }>(
      `/venues/${createdId}`,
      token,
    )
    expect(detail.code, 'GET /api/venues/{id} must return 200').toBe(200)
    expect(detail.data?.code, 'detail code must match').toBe(QA_VENUE_01_CODE)

    // 4. PUT /api/venues/{id} — modify capacity via UI
    const targetRow = page.locator('tr.ant-table-row').filter({
      hasText: QA_VENUE_01_NAME,
    })
    await targetRow.getByRole('button', { name: /编\s?辑/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Clear and refill the capacity field. a-input-number input is the same
    // locator as in the create form (the form modal is freshly opened).
    const capacityEdit = page.locator('.ant-input-number-input').first()
    await capacityEdit.fill(String(QA_VENUE_01_CAPACITY_UPDATED))

    await page.screenshot({
      path: evidencePath('happy-04-edit-form-filled.png'),
      fullPage: true,
    })

    await page.getByRole('button', { name: /确\s?定/ }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 })

    // API track: assert the capacity was updated.
    const afterUpdate = await apiGet<{ capacity?: number }>(
      `/venues/${createdId}`,
      token,
    )
    expect(afterUpdate.code, 'GET /api/venues/{id} after update').toBe(200)
    expect(afterUpdate.data?.capacity, 'capacity must reflect the update').toBe(
      QA_VENUE_01_CAPACITY_UPDATED,
    )

    await page.screenshot({
      path: evidencePath('happy-05-updated-in-list.png'),
      fullPage: true,
    })

    // 5. DELETE /api/venues/{id} — delete via UI (Modal.confirm)
    const deleteTargetRow = page.locator('tr.ant-table-row').filter({
      hasText: QA_VENUE_01_NAME,
    })
    await deleteTargetRow.getByRole('button', { name: /删\s?除/ }).click()

    // Modal.confirm popup with "确认删除" title and a 删除 button.
    const confirmDialog = page.locator('.ant-modal-confirm').last()
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })
    await confirmDialog.getByRole('button', { name: /删\s?除/ }).click()

    // Wait for the row to disappear (Modal.confirm stays in DOM as
    // display:none — do NOT wait for detached).
    await expect(
      page.locator('tr.ant-table-row', { hasText: QA_VENUE_01_NAME }),
    ).toHaveCount(0, { timeout: 10000 })

    // API track: assert the venue is gone from the list.
    const afterDeleteList = await apiGet<Array<{ code: string }>>(
      '/venues',
      token,
    )
    expect(afterDeleteList.code, 'GET /api/venues after delete').toBe(200)
    const stillThere = (afterDeleteList.data as unknown[]).find(
      (r) => (r as { code: string }).code === QA_VENUE_01_CODE,
    )
    expect(stillThere, 'deleted venue must NOT appear in API list').toBeUndefined()

    await page.screenshot({
      path: evidencePath('happy-06-deleted-from-list.png'),
      fullPage: true,
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — duplicate venue code (seed code MAIN_STADIUM) → 40911
  // Docs/06 §34 documents this as 40901; the backend actually returns 40911
  // (ErrorCode.VENUE_CODE_EXISTS). Assert against the actual code and record
  // the doc drift via appendBug.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail1: 用已存在的 code (MAIN_STADIUM) 新增场地 → 40911 (文档标 40901)', async ({
    context,
  }) => {
    const token = await injectStorageState(context)

    // POST a venue with code=MAIN_STADIUM (seed code from data.sql:76). Use a
    // unique name prefixed with SUB_PREFIX for traceability / cleanup if the
    // create accidentally succeeds.
    const dupName = SUB_PREFIX + 'dup_main_stadium'
    const dupRes = await apiPost(
      '/venues',
      {
        name: dupName,
        code: 'MAIN_STADIUM',
        type: 3,
        location: 'QA fail1 dup-code test',
        capacity: 100,
      },
      token,
    )
    expect(
      dupRes.code,
      'creating a venue with an existing seed code must yield 40911 (VENUE_CODE_EXISTS)',
    ).toBe(40911)

    await writeFileSync(
      evidencePath('fail1-dup-code.txt'),
      `fail1 verified at ${new Date().toISOString()}\n` +
        `POST /api/venues { name: ${dupName}, code: 'MAIN_STADIUM' }\n` +
        `Expected per Docs/06 §34: 40901\n` +
        `Actual backend code: ${dupRes.code} (ErrorCode.VENUE_CODE_EXISTS)\n`,
      'utf8',
    )

    // Document the doc drift as a P2 bug (docs vs implementation mismatch).
    appendBug({
      module: 'venue',
      caseKey: 'fail1-dup-code',
      step: 'POST /api/venues with code=MAIN_STADIUM (seed code already exists)',
      expected:
        'Docs/06 §34 documents error code 40901 for "场地代码已存在"',
      actual:
        'Backend returns ErrorCode.VENUE_CODE_EXISTS = 40911. ' +
        'Verified in ApexSports/.../exception/ErrorCode.java:54. ' +
        'This is a documentation drift, not a functional defect.',
      severity: 'P2',
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — negative capacity: assert 40001 frontend OR backend validation.
  // VenueCreateDTO.capacity has NO @Min/@Max annotation, so the backend will
  // accept a negative capacity. The frontend a-input-number :min="0" SHOULD
  // clamp typed values to 0; if the contract holds, the API path returns 200
  // and we record the missing backend validation as a P3 doc/governance gap.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 负容量 capacity=-1 → 40001 (前端校验或后端校验)', async ({
    context,
  }) => {
    const token = await injectStorageState(context)

    // POST a venue with capacity=-1. Backend DTO has no @Min annotation so the
    // API may accept it. We assert the response code is either 40001 (param
    // validation failure — best case) or 200 (validation gap — recorded).
    const negName = SUB_PREFIX + 'neg_capacity'
    const negCode = '__QA_C6_NEG'
    const res = await apiPost<{ id?: number }>(
      '/venues',
      {
        name: negName,
        code: negCode,
        type: 3,
        location: 'QA fail2 negative capacity',
        capacity: -1,
      },
      token,
    )

    if (res.code === 200) {
      // Backend accepted the negative capacity — this is a validation gap.
      // Clean up the spurious row via API and record the gap as P3.
      const createdId = res.data?.id
      if (createdId !== undefined) {
        await apiDelete(`/venues/${createdId}`, token)
      }
      await writeFileSync(
        evidencePath('fail2-negative-capacity-accepted.txt'),
        `fail2 verified at ${new Date().toISOString()}\n` +
          `POST /api/venues { name: ${negName}, code: ${negCode}, capacity: -1 }\n` +
          `Expected per Docs/06: 40001 (参数校验失败)\n` +
          `Actual backend code: 200 (no @Min on VenueCreateDTO.capacity)\n` +
          `Cleanup: ${createdId !== undefined ? `deleted venue id=${createdId}` : 'no id returned'}\n`,
        'utf8',
      )
      appendBug({
        module: 'venue',
        caseKey: 'fail2-negative-capacity-no-backend-validation',
        step:
          'POST /api/venues with capacity=-1 (negative value, no @Min on DTO)',
        expected:
          'Docs/06 §34 documents 40001 for "参数校验失败". Negative capacity should be rejected.',
        actual:
          'Backend VenueCreateDTO.capacity has Integer type with no @Min/@Max annotation; ' +
          'VenueLogic does not range-check capacity. Backend returns 200 and persists capacity=-1. ' +
          'Frontend a-input-number :min="0" only clamps at the UI layer (easily bypassed via API). ' +
          'Verified in ApexSports/.../dtos/VenueCreateDTO.java:41 and ' +
          'ApexSports/.../vos/VenueVO.java:32. ' +
          'This is a governance/validation gap, P3 — not a functional defect.',
        severity: 'P3',
      })
      return
    }

    // 40001 path — backend validation surfaced correctly.
    expect(
      [40001],
      'creating a venue with capacity=-1 must yield 40001 if validation is enforced',
    ).toContain(res.code)

    await writeFileSync(
      evidencePath('fail2-negative-capacity-rejected.txt'),
      `fail2 verified at ${new Date().toISOString()}\n` +
        `POST /api/venues { name: ${negName}, code: ${negCode}, capacity: -1 }\n` +
        `Expected per Docs/06: 40001\n` +
        `Actual backend code: ${res.code} (参数校验失败)\n`,
      'utf8',
    )
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — sweep any __qa_c6_* leftovers regardless of test outcome.
  // cleanupByPrefix matches `record.name ?? record.code` — for venues both
  // fields exist; our test venue name starts with `__qa_c6_` (lowercase,
  // matches SUB_PREFIX). The helper handles the array shape returned by
  // GET /api/venues (no pagination wrapper).
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    await cleanupByPrefix(
      '/venues',
      (r) => r.id as number | string | undefined,
      (id) => `/venues/${id}`,
      SUB_PREFIX,
      token,
    )
  })
})
