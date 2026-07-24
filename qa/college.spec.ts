// ApexSports QA — C2 学院管理模块 spec (college)
//
// Covers Docs/02-学院管理模块.md:
//   - GET    /api/colleges       (列表，不分页)
//   - GET    /api/colleges/{id}  (详情)
//   - POST   /api/colleges       (新增, admin only)
//   - PUT    /api/colleges/{id}  (修改, admin only)
//   - DELETE /api/colleges/{id}  (逻辑删除, admin only)
//
// NOTE on error-code drift (verified against
// ApexSports/.../exception/ErrorCode.java):
//   - Docs/02 §11 says 40901 for "学院代码已存在", but the backend actually
//     throws ErrorCode.COLLEGE_CODE_EXISTS = 40903.
//   - Docs/02 §13 says 40901 for "学院下存在关联运动员，不可删除", but
//     the backend throws ErrorCode.COLLEGE_IN_USE = 40904.
//   The spec asserts against the ACTUAL backend codes (40903 / 40904) and
//   documents the doc drift via appendBug. See fail1 and fail2 cases.
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent CJK
// chars. "新增学院" renders as "新 增 学 院", "删除" as "删 除", "确定" as
// "确 定". All Chinese button labels are matched with a regex that tolerates
// 0-or-1 whitespace between each char (see learnings.md 2026-07-21 11:15:00).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
import type { BrowserContext } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { qaTest } from './lib/fixtures'
import {
  apiLogin,
  apiGet,
  apiPost,
  apiDelete,
  cleanupByPrefix,
} from './lib/api'
import { PREFIX, appendBug } from './lib/reporter'

const SUB_PREFIX = PREFIX + 'c2_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-college'
const SKIPPED_FAIL2_REASON_PATH = resolve(
  EVIDENCE_DIR,
  'skipped-fail2-reason.txt',
)
const STORAGE_STATE_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/admin.storageState.json'

// Test entity constants (single source of truth for both UI + API tracks).
const QA_COLLEGE_01_NAME = SUB_PREFIX + 'college_01'
const QA_COLLEGE_01_CODE = '__QA_C2_01'
const QA_COLLEGE_01_DESC = 'QA测试学院01'
const QA_COLLEGE_01_DESC_UPDATED = 'QA测试学院01-已修改'

mkdirSync(EVIDENCE_DIR, { recursive: true })

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * Hard-delete soft-deleted `__qa_c2_` residual rows directly from the DB.
 *
 * Why this is needed (same trap as as_user / C1):
 * - as_college has a uniqueness check in CollegeLogic.create via countByCode,
 *   but countByCode filters deleted=0 (MyBatis-Plus logic-delete default).
 *   A soft-deleted row with the same code lingers with deleted=1 and is
 *   invisible to the API check, but the physical INSERT can still hit a
 *   UNIQUE constraint if one exists on `code`.
 * - The API list endpoint filters deleted=1 rows, so cleanupByPrefix (API
 *   sweep in afterAll) cannot see or remove soft-deleted leftovers.
 *
 * Order: athletes first (they reference college_id), then colleges.
 */
function hardCleanupQaColleges(): void {
  const cmds = [
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_athlete WHERE name LIKE '__qa_c2_%' OR student_no LIKE '__qa_c2_%';\"",
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_college WHERE name LIKE '__qa_c2_%' OR code LIKE '__QA_C2_%';\"",
  ]
  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: 'pipe', timeout: 5000 })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[C2 college] hardCleanupQaColleges failed (docker / mysql unavailable);',
        'falling back to API cleanup in afterAll.',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

/**
 * Injects the persisted admin storageState into the page via an init script.
 *
 * Why: qaTest fixture's storageState option (Playwright 1.61 + ESM) does not
 * reliably inject localStorage entries into the page on this system (verified
 * in C1 happy3). Mirrors the C1 happy3 workaround.
 */
async function injectStorageState(
  context: BrowserContext,
): Promise<string> {
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
 * cleanupByPrefix matches `record.name ?? record.code` — for colleges both
 * fields exist; our test colleges use name=`__qa_c2_college_01` (lowercase,
 * matches SUB_PREFIX). The helper handles both array and {records} shapes.
 *
 * Athletes use `/athletes` (paginated, returns {records}); athlete.name also
 * matches SUB_PREFIX for our test athlete `__qa_c2_athlete_tmp`.
 */

test.describe.serial('C2 学院管理模块', () => {
  test.beforeAll(async () => {
    hardCleanupQaColleges()
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy — full CRUD via UI + API dual-track
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy: 学院 CRUD (列表/新增/修改/删除) — UI + API 双轨', async ({
    page,
    context,
  }) => {
    const token = await injectStorageState(context)
    process.env.QA_TOKEN = token

    // 1. GET /api/colleges — list baseline (≥8 seed rows per data.sql:20-28)
    const beforeList = await apiGet<
      Array<{ id: number; name: string; code: string }>
    >('/colleges', token)
    expect(beforeList.code, 'GET /api/colleges must return 200').toBe(200)
    expect(
      Array.isArray(beforeList.data),
      'colleges list must be an array (no pagination)',
    ).toBeTruthy()
    expect(
      (beforeList.data as unknown[]).length,
      'seed colleges must be ≥8 (data.sql seeds 8)',
    ).toBeGreaterThanOrEqual(8)

    await page.goto('/college')
    await page.waitForLoadState('domcontentloaded')

    // Assert the table renders at least the 8 seed rows. Ant table body rows
    // are <tr class="ant-table-row">.
    const tableRows = page.locator('tbody.ant-table-tbody tr.ant-table-row')
    await expect(tableRows.first(), 'at least one table row must render').toBeVisible()
    const rowCountBefore = await tableRows.count()
    expect(rowCountBefore, 'UI table must show ≥8 seed rows').toBeGreaterThanOrEqual(8)

    await page.screenshot({
      path: evidencePath('happy-01-list-baseline.png'),
      fullPage: true,
    })

    // 2. POST /api/colleges — create __qa_c2_college_01 via UI form
    await page.getByRole('button', { name: /新\s?增\s?学\s?院/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByPlaceholder('请输入学院名称').fill(QA_COLLEGE_01_NAME)
    await page.getByPlaceholder('请输入学院代码').fill(QA_COLLEGE_01_CODE)
    await page.getByPlaceholder('请输入学院描述（可选）').fill(QA_COLLEGE_01_DESC)

    await page.screenshot({
      path: evidencePath('happy-02-create-form-filled.png'),
      fullPage: true,
    })

    // Ant modal OK button text is "确定" → "确 定" after CJK auto-spacing.
    await page.getByRole('button', { name: /确\s?定/ }).click()

    // Wait for the modal to close (form submitted + list reloaded).
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 })

    // API track: assert the new college exists.
    const afterCreateList = await apiGet<
      Array<{ id: number; name: string; code: string; description?: string }>
    >('/colleges', token)
    expect(afterCreateList.code, 'GET /api/colleges after create').toBe(200)
    const created = (afterCreateList.data as unknown[]).find(
      (r) => (r as { code: string }).code === QA_COLLEGE_01_CODE,
    ) as { id: number; name: string; code: string; description?: string } | undefined
    expect(created, 'created college must appear in API list').toBeDefined()
    expect(created!.name, 'created college name must match').toBe(QA_COLLEGE_01_NAME)
    expect(created!.description, 'created college desc must match').toBe(QA_COLLEGE_01_DESC)
    const createdId = created!.id

    // UI track: assert the new college row appears in the table.
    await expect(page.getByText(QA_COLLEGE_01_NAME)).toBeVisible()
    await page.screenshot({
      path: evidencePath('happy-03-created-in-list.png'),
      fullPage: true,
    })

    // 3. GET /api/colleges/{id} — detail
    const detail = await apiGet<{ id: number; code: string }>(
      `/colleges/${createdId}`,
      token,
    )
    expect(detail.code, 'GET /api/colleges/{id} must return 200').toBe(200)
    expect(detail.data?.code, 'detail code must match').toBe(QA_COLLEGE_01_CODE)

    // 4. PUT /api/colleges/{id} — modify description via UI
    // Find the row containing our test college name, click its 编辑 button.
    const targetRow = page.locator('tr.ant-table-row').filter({
      hasText: QA_COLLEGE_01_NAME,
    })
    await targetRow.getByRole('button', { name: /编\s?辑/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Clear and refill the description field.
    const descTextarea = page.locator('textarea').first()
    await descTextarea.fill(QA_COLLEGE_01_DESC_UPDATED)

    await page.screenshot({
      path: evidencePath('happy-04-edit-form-filled.png'),
      fullPage: true,
    })

    await page.getByRole('button', { name: /确\s?定/ }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 })

    // API track: assert the description was updated.
    const afterUpdate = await apiGet<{ description?: string }>(
      `/colleges/${createdId}`,
      token,
    )
    expect(afterUpdate.code, 'GET /api/colleges/{id} after update').toBe(200)
    expect(
      afterUpdate.data?.description,
      'description must reflect the update',
    ).toBe(QA_COLLEGE_01_DESC_UPDATED)

    await page.screenshot({
      path: evidencePath('happy-05-updated-in-list.png'),
      fullPage: true,
    })

    // 5. DELETE /api/colleges/{id} — delete via UI (Modal.confirm)
    const deleteTargetRow = page.locator('tr.ant-table-row').filter({
      hasText: QA_COLLEGE_01_NAME,
    })
    await deleteTargetRow.getByRole('button', { name: /删\s?除/ }).click()

    // Modal.confirm popup with "确定要删除..." title and a 删除 button.
    const confirmDialog = page.locator('.ant-modal-confirm').last()
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })
    await confirmDialog.getByRole('button', { name: /删\s?除/ }).click()

    // Wait for the row to disappear.
    await expect(
      page.locator('tr.ant-table-row', { hasText: QA_COLLEGE_01_NAME }),
    ).toHaveCount(0, { timeout: 10000 })

    // API track: assert the college is gone from the list.
    const afterDeleteList = await apiGet<
      Array<{ code: string }>
    >('/colleges', token)
    expect(afterDeleteList.code, 'GET /api/colleges after delete').toBe(200)
    const stillThere = (afterDeleteList.data as unknown[]).find(
      (r) => (r as { code: string }).code === QA_COLLEGE_01_CODE,
    )
    expect(stillThere, 'deleted college must NOT appear in API list').toBeUndefined()

    await page.screenshot({
      path: evidencePath('happy-06-deleted-from-list.png'),
      fullPage: true,
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — duplicate college code (seed code "CS") → 40903
  // Docs/02 §11 documents this as 40901; the backend actually returns 40903
  // (ErrorCode.COLLEGE_CODE_EXISTS). Assert against the actual code and
  // record the doc drift via appendBug.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail1: 用已存在的 code (CS) 新增学院 → 40903 (文档标 40901)', async ({
    context,
  }) => {
    const token = await injectStorageState(context)

    // POST a college with code=CS (seed code from data.sql:21). Use a unique
    // name so we can identify it for cleanup if the create accidentally succeeds.
    const dupName = SUB_PREFIX + 'dup_cs'
    const dupRes = await apiPost(
      '/colleges',
      { name: dupName, code: 'CS', description: 'QA fail1 dup-code test' },
      token,
    )
    expect(
      dupRes.code,
      'creating a college with an existing seed code must yield 40903 (COLLEGE_CODE_EXISTS)',
    ).toBe(40903)

    await writeFileSync(
      evidencePath('fail1-dup-code.txt'),
      `fail1 verified at ${new Date().toISOString()}\n` +
        `POST /api/colleges { name: ${dupName}, code: 'CS' }\n` +
        `Expected per Docs/02 §11: 40901\n` +
        `Actual backend code: ${dupRes.code} (ErrorCode.COLLEGE_CODE_EXISTS)\n`,
      'utf8',
    )

    // Document the doc drift as a P2 bug (docs vs implementation mismatch).
    appendBug({
      module: 'college',
      caseKey: 'fail1-dup-code',
      step: 'POST /api/colleges with code=CS (seed code already exists)',
      expected:
        'Docs/02 §11 documents error code 40901 for "学院代码已存在"',
      actual:
        'Backend returns ErrorCode.COLLEGE_CODE_EXISTS = 40903. ' +
        'Verified in ApexSports/.../exception/ErrorCode.java:48. ' +
        'This is a documentation drift, not a functional defect.',
      severity: 'P2',
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — referenced-delete: create a college + an athlete referencing it,
  // then DELETE the college → expect 40904 (COLLEGE_IN_USE). Docs/02 §13
  // documents this as 40901; the backend actually returns 40904.
  // If athlete creation fails (e.g. backend not running, schema drift, or
  // any other reason), the case is test.skip()'d and the reason is persisted.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 学院下存在关联运动员 → DELETE → 40904 (文档标 40901)', async ({
    context,
  }) => {
    const token = await injectStorageState(context)

    // Step 1: create a fresh college to attach the athlete to.
    const collegeName = SUB_PREFIX + 'college_ref'
    const collegeCode = '__QA_C2_REF'
    const collegeRes = await apiPost<{ id: number }>(
      '/colleges',
      { name: collegeName, code: collegeCode, description: 'QA fail2 ref college' },
      token,
    )
    if (collegeRes.code !== 200) {
      const reason =
        `Skipped at ${new Date().toISOString()}\n` +
        `Reason: failed to create reference college for fail2.\n` +
        `POST /api/colleges returned code=${collegeRes.code} ` +
        `message=${collegeRes.message}.\n`
      writeFileSync(SKIPPED_FAIL2_REASON_PATH, reason, 'utf8')
      test.skip(true, reason)
      return
    }
    const collegeId = collegeRes.data!.id

    // Step 2: create an athlete referencing that college.
    // Athlete required fields (Docs/03 §16): collegeId, name, studentNo, gender.
    const athleteName = SUB_PREFIX + 'athlete_tmp'
    const studentNo = SUB_PREFIX + 'sn_001'
    const athleteRes = await apiPost<{ id: number }>(
      '/athletes',
      {
        collegeId,
        name: athleteName,
        studentNo,
        gender: 1,
        grade: '2024',
        phone: '13800000099',
      },
      token,
    )
    if (athleteRes.code !== 200) {
      const reason =
        `Skipped at ${new Date().toISOString()}\n` +
        `Reason: failed to create reference athlete for fail2.\n` +
        `POST /api/athletes returned code=${athleteRes.code} ` +
        `message=${athleteRes.message}.\n` +
        `College was created (id=${collegeId}) and will be cleaned in afterAll.\n`
      writeFileSync(SKIPPED_FAIL2_REASON_PATH, reason, 'utf8')
      test.skip(true, reason)
      return
    }

    // Step 3: attempt to delete the college — must be blocked.
    const delRes = await apiDelete(`/colleges/${collegeId}`, token)
    expect(
      delRes.code,
      'deleting a college referenced by an athlete must yield 40904 (COLLEGE_IN_USE)',
    ).toBe(40904)

    await writeFileSync(
      evidencePath('fail2-referenced-delete.txt'),
      `fail2 verified at ${new Date().toISOString()}\n` +
        `Created college id=${collegeId} code=${collegeCode}; ` +
        `created athlete id=${athleteRes.data!.id} referencing it.\n` +
        `DELETE /api/colleges/${collegeId} returned code=${delRes.code}.\n` +
        `Expected per Docs/02 §13: 40901\n` +
        `Actual backend code: ${delRes.code} (ErrorCode.COLLEGE_IN_USE)\n`,
      'utf8',
    )

    appendBug({
      module: 'college',
      caseKey: 'fail2-referenced-delete',
      step:
        'DELETE /api/colleges/{id} where the college has a referencing athlete',
      expected:
        'Docs/02 §13 documents error code 40901 for "该学院下存在关联运动员，不可删除"',
      actual:
        'Backend returns ErrorCode.COLLEGE_IN_USE = 40904. ' +
        'Verified in ApexSports/.../exception/ErrorCode.java:49. ' +
        'This is a documentation drift, not a functional defect.',
      severity: 'P2',
    })

    // NOTE: leave cleanup to afterAll (hard-delete + API sweep). The athlete
    // blocks the college delete, and we don't want to delete the athlete here
    // because doing so would mask the fail2 scenario on re-run if beforeAll
    // hard-cleanup is skipped (e.g. docker unavailable).
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — sweep any __qa_c2_* leftovers regardless of test outcome.
  // Order: athletes first (FK reference), then colleges.
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    // Sweep test athletes first (they reference college_id).
    await cleanupByPrefix(
      '/athletes?current=1&size=200',
      (r) => r.id as number | string | undefined,
      (id) => `/athletes/${id}`,
      SUB_PREFIX,
      token,
    )

    // Then sweep test colleges (name starts with SUB_PREFIX).
    await cleanupByPrefix(
      '/colleges',
      (r) => r.id as number | string | undefined,
      (id) => `/colleges/${id}`,
      SUB_PREFIX,
      token,
    )
  })
})
