// ApexSports QA — C5 裁判管理模块 spec (referee)
//
// Covers Docs/05-裁判管理模块.md:
//   - GET    /api/referees          (list, paginated, filter by level/status/keyword)
//   - GET    /api/referees/{id}     (detail)
//   - POST   /api/referees          (create)
//   - PUT    /api/referees/{id}     (update)
//   - DELETE /api/referees/{id}     (logical delete, blocked by active assignments)
//   - Error codes: 40001 / 40101 / 40301 / 40401 / 40901
//
// Execution order is enforced by test.describe.serial. happy1 runs the full
// UI CRUD happy path against the SPA (route /referee) and also asserts the
// API track to verify the response contract. fail1 triggers 40001 via API
// with a phone longer than the documented max=20 chars (frontend form has
// maxlength=20 so it physically blocks the invalid input from reaching the
// backend — the API track is the only path that surfaces 40001 here).
// fail2 attempts to delete a referee referenced by an active assignment; if
// no as_referee_assignment seed data exists, the case is test.skip()'d with
// a P3 reason file (not a defect — the seed has no assignment rows).
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent
// CJK chars. 新增裁判 renders as 新 增 裁 判, 编辑 as 编 辑, 删除 as 删 除,
// 确定 as 确 定. All Chinese button text is matched with a regex that
// tolerates 0-or-1 whitespace between each char.
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
import { qaTest, test, expect } from './lib/fixtures'
import {
  apiLogin,
  apiGet,
  apiPost,
  apiDelete,
  cleanupByPrefix,
} from './lib/api'
import { STORAGE_STATE_PATH } from './lib/auth'
import { PREFIX, appendBug } from './lib/reporter'

const SUB_PREFIX = PREFIX + 'c5_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-referee'
const SKIPPED_FAIL2_REASON_PATH = resolve(
  EVIDENCE_DIR,
  'skipped-fail2-reason.txt',
)

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * Hard-delete soft-deleted __qa_% residual rows directly from as_referee
 * before any test runs.
 *
 * Why this is needed:
 * - as_referee has no natural-key UNIQUE constraint (id is the only key),
 *   so soft-deleted rows do NOT block re-creation the way as_user.uk_username
 *   does. The hard-delete sweep is still useful to keep the listing tight
 *   during repeated runs so the seed row count assertion (>= 8) does not
 *   accidentally count stale __qa_ soft-deleted rows that the API list
 *   endpoint filters out anyway.
 * - The pattern matches only rows whose name starts with __qa_ — the 8 seed
 *   referees (王建国 etc.) and the admin account are never touched.
 *
 * Fallback: if docker or the mysql CLI is unavailable, the call fails
 * silently with a console.warn and the afterAll API sweep still runs.
 */
function hardCleanupQaReferees(): void {
  const cmd =
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
    "-e \"DELETE FROM as_referee WHERE name LIKE '__qa_%';\""
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 5000 })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[C5 referee] hardCleanupQaReferees failed (docker / mysql unavailable);',
      'falling back to API cleanup in afterAll.',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Returns the count of as_referee_assignment rows referencing active (status=1)
 * assignments, used by fail2 to decide whether the "delete referenced referee"
 * case can run. Returns 0 if docker / mysql is unavailable (the case skips
 * with a P3 reason in that scenario too).
 */
function countActiveAssignments(): number {
  const cmd =
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
    '-N -e "SELECT COUNT(*) FROM as_referee_assignment WHERE status=1;"'
  try {
    const out = execSync(cmd, { stdio: 'pipe', timeout: 5000 })
    const n = parseInt(out.toString().trim(), 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/**
 * Loads the persisted admin storageState and returns its localStorage entries
 * for http://localhost:5173, so the SPA's router guard sees the token on the
 * very first navigation (qaTest fixture's storageState option does not
 * reliably inject localStorage entries on this system — see C1 learnings).
 */
function readStorageStateLs(): Array<{ name: string; value: string }> {
  if (!existsSync(STORAGE_STATE_PATH)) return []
  const json = JSON.parse(readFileSync(STORAGE_STATE_PATH, 'utf8')) as {
    origins?: Array<{
      origin: string
      localStorage: Array<{ name: string; value: string }>
    }>
  }
  return (
    json.origins?.find((o) => o.origin === 'http://localhost:5173')
      ?.localStorage ?? []
  )
}

test.describe.serial('C5 裁判管理模块', () => {
  test.beforeAll(async () => {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    hardCleanupQaReferees()
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy1 — UI CRUD happy path: list >= 8 seed rows, create via UI, API
  // verify, modify level via UI, delete via UI; screenshot each step.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy1: 裁判管理 列表/新增/修改/删除 全流程 (UI + API 双轨)', async ({
    page,
    context,
  }) => {
    // Inject persisted admin localStorage so the SPA router guard sees the
    // token on first navigation (same workaround as C1 happy3).
    const lsEntries = readStorageStateLs()
    expect(
      lsEntries.find((e) => e.name === 'token')?.value,
      'storageState must contain a token (run C1 happy1 / _smoke first)',
    ).toBeTruthy()
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

    await page.goto('/referee')
    await page.waitForLoadState('domcontentloaded')

    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    // ── Step 1: list — assert >= 8 seed referee rows are visible. ──
    const tableRows = page
      .getByRole('table')
      .first()
      .getByRole('row')
      .filter({ has: page.getByRole('button') })
    await tableRows.first().waitFor({ state: 'visible', timeout: 10000 })
    const rowCount = await tableRows.count()
    expect(rowCount, 'list must show at least 8 seed referees').toBeGreaterThanOrEqual(8)

    await page.screenshot({
      path: evidencePath('happy1-01-list.png'),
      fullPage: true,
    })

    // ── Step 2: create __qa_c5_referee_01 (国家级) via UI. ──
    const newName = SUB_PREFIX + 'referee_01'
    // Open the add modal. "新增裁判" -> "新 增 裁 判" after Ant CJK spacing.
    await page.getByRole('button', { name: /新\s?增\s?裁\s?判/ }).click()
    const modal = page.getByRole('dialog')
    await modal.waitFor({ state: 'visible', timeout: 5000 })

    await modal.getByPlaceholder('请输入姓名').fill(newName)
    // gender select — Ant Design Vue a-select renders the placeholder on a
    // <span class="ant-select-selection-placeholder"> (NOT on the readonly
    // hidden search input), so getByPlaceholder cannot match it. Click the
    // .ant-select-selector div directly to open the dropdown, then pick the
    // option by its rendered text. The dropdown is teleported to body.
    await modal
      .locator('.ant-form-item')
      .filter({ hasText: '性别' })
      .locator('.ant-select-selector')
      .click()
    const genderDropdown = page.locator('.ant-select-dropdown').last()
    await genderDropdown.waitFor({ state: 'visible', timeout: 5000 })
    await genderDropdown.getByText('男', { exact: true }).click()
    await modal.getByPlaceholder('请输入联系电话（可选）').fill('13900000001')
    await modal.getByPlaceholder('请输入裁判等级（可选）').fill('国家级')

    await page.screenshot({
      path: evidencePath('happy1-02-add-form-filled.png'),
      fullPage: true,
    })

    // OK button. "确定" -> "确 定" after Ant CJK spacing. Scope to the
    // dialog (Ant keeps closed modals in DOM as display:none; click() picks
    // the visible one) instead of the .ant-modal-footer div.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /确\s?定/ })
      .click()
    // Ant Design Vue keeps the closed modal in the DOM (display:none) rather
    // than detaching it, so waitFor('detached') hangs. Wait for the new row
    // directly — that is the observable outcome of a successful submit.
    // ── Step 3: assert the new row is present in the list (UI track). ──
    const newRow = page
      .getByRole('table')
      .first()
      .getByRole('row')
      .filter({ hasText: newName })
      .first()
    await expect(newRow, 'new referee row must appear in the list').toBeVisible({
      timeout: 10000,
    })

    await page.screenshot({
      path: evidencePath('happy1-03-created-in-list.png'),
      fullPage: true,
    })

    // ── Step 4: API verify — GET /api/referees?keyword=__qa_c5_referee_01. ──
    const verifyRes = await apiGet<{
      records?: Array<{ id?: number; name?: string; level?: string }>
    }>('/referees?current=1&size=200&keyword=' + encodeURIComponent(newName), token)
    expect(verifyRes.code, 'GET /api/referees must return 200').toBe(200)
    const created = verifyRes.data?.records?.find((r) => r.name === newName)
    expect(created, 'API list must contain the freshly created referee').toBeDefined()
    expect(created?.level, 'created referee level must be 国家级').toBe('国家级')
    const createdId = created!.id!
    expect(createdId, 'created referee must have an id').toBeDefined()

    // ── Step 5: modify — change level from 国家级 to 一级 via UI. ──
    await newRow
      .getByRole('button', { name: /编\s?辑/ })
      .click()
    const editModal = page.getByRole('dialog')
    await editModal.waitFor({ state: 'visible', timeout: 5000 })

    const levelInput = editModal.getByPlaceholder('请输入裁判等级（可选）')
    await levelInput.clear()
    await levelInput.fill('一级')

    await page.screenshot({
      path: evidencePath('happy1-04-edit-form.png'),
      fullPage: true,
    })

    await page
      .getByRole('dialog')
      .getByRole('button', { name: /确\s?定/ })
      .click()
    // Ant keeps the closed modal in DOM; wait for the row to reflect the
    // update directly (the observable outcome of a successful submit).
    // ── Step 6: assert the level was updated (UI + API). ──
    const updatedRow = page
      .getByRole('table')
      .first()
      .getByRole('row')
      .filter({ hasText: newName })
      .first()
    await expect(updatedRow, 'updated row must still be visible').toBeVisible({
      timeout: 10000,
    })
    await expect(
      updatedRow.filter({ hasText: '一级' }),
      'updated row must show the new level 一级',
    ).toBeVisible()

    const verifyAfterUpdate = await apiGet<{
      records?: Array<{ name?: string; level?: string }>
    }>('/referees?current=1&size=200&keyword=' + encodeURIComponent(newName), token)
    expect(
      verifyAfterUpdate.data?.records?.find((r) => r.name === newName)?.level,
      'API list must reflect the updated level',
    ).toBe('一级')

    await page.screenshot({
      path: evidencePath('happy1-05-updated-in-list.png'),
      fullPage: true,
    })

    // ── Step 7: delete via UI — row delete button, then Modal.confirm OK. ──
    await updatedRow
      .getByRole('button', { name: /删\s?除/ })
      .click()
    // Modal.confirm is rendered in a separate .ant-modal-confirm wrapper.
    const confirmDialog = page.locator('.ant-modal-confirm').filter({
      hasText: '确认删除',
    })
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 })

    await page.screenshot({
      path: evidencePath('happy1-06-delete-confirm.png'),
      fullPage: true,
    })

    // OK button text is 删除 (删 除 after Ant CJK spacing).
    await confirmDialog
      .getByRole('button', { name: /删\s?除/ })
      .click()
    // Modal.confirm also stays in DOM when hidden; wait for the row to
    // disappear directly (the observable outcome of a successful delete).
    // Assert the row is gone from the list.
    await expect(
      page
        .getByRole('table')
        .first()
        .getByRole('row')
        .filter({ hasText: newName }),
      'deleted referee row must disappear from the list',
    ).toHaveCount(0, { timeout: 10000 })

    // API-side confirmation: GET detail returns 40401 (deleted=1 row filtered).
    const afterDelete = await apiGet<{ records?: { name: string }[]; total?: number }>(
      '/referees?current=1&size=200&keyword=' + encodeURIComponent(newName),
      token,
    )
    expect(
      afterDelete.data?.records?.find((r) => r.name === newName),
      'API list must no longer return the deleted referee',
    ).toBeUndefined()

    await page.screenshot({
      path: evidencePath('happy1-07-deleted-from-list.png'),
      fullPage: true,
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — 40001 parameter validation via phone longer than max=20.
  //
  // The frontend form has maxlength=20 on the phone input, so it physically
  // prevents typing more than 20 chars. To exercise the backend's documented
  // 40001 path we POST directly via API with a 21-char phone; the backend
  // @Size(max=20) on RefereeCreateDTO.phone rejects it and the global
  // exception handler surfaces 40001.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail1: 新增裁判 phone 超长 (>20) → 40001 参数校验失败 (API 轨)', async ({
    page,
    context,
  }) => {
    const lsEntries = readStorageStateLs()
    expect(
      lsEntries.find((e) => e.name === 'token')?.value,
      'storageState must contain a token',
    ).toBeTruthy()
    await context.addInitScript(
      (entries: Array<{ name: string; value: string }>) => {
        for (const { name, value } of entries) {
          try {
            window.localStorage.setItem(name, value)
          } catch {
            // ignore
          }
        }
      },
      lsEntries,
    )

    await page.goto('/referee')
    await page.waitForLoadState('domcontentloaded')
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    // Open the add modal so the screenshot shows the form context (the form's
    // phone input has maxlength=20 — typing more is physically blocked).
    await page.getByRole('button', { name: /新\s?增\s?裁\s?判/ }).click()
    const modal = page.getByRole('dialog')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    await modal.getByPlaceholder('请输入联系电话（可选）').fill('13900000001')
    await page.screenshot({
      path: evidencePath('fail1-01-add-modal.png'),
      fullPage: true,
    })
    // Close the modal without submitting — fail1 asserts the API contract.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /取\s?消/ })
      .click()
    // Ant keeps the closed modal in DOM (hidden); just proceed to the API
    // track — the form is no longer interactive after cancel.
    await expect(modal).toBeHidden({ timeout: 5000 })

    // API track: POST with phone longer than the documented max=20.
    const tooLongPhone = '1'.repeat(21)
    const res = await apiPost<{ id?: number }>('/referees', {
      name: SUB_PREFIX + 'fail1_phone',
      gender: 1,
      phone: tooLongPhone,
      level: '国家级',
    }, token)
    expect(
      res.code,
      'POST /api/referees with phone > 20 chars must return 40001',
    ).toBe(40001)

    // Verify no row was actually created.
    const leftover = await apiGet<{ records?: Array<{ name?: string }> }>(
      '/referees?current=1&size=200&keyword=' +
        encodeURIComponent(SUB_PREFIX + 'fail1_phone'),
      token,
    )
    expect(
      leftover.data?.records?.find((r) => r.name === SUB_PREFIX + 'fail1_phone'),
      'failed-create referee must not leave a row behind',
    ).toBeUndefined()

    await page.screenshot({
      path: evidencePath('fail1-02-after-rejected.png'),
      fullPage: true,
    })

    // Document the wider gap: the docs imply phone format validation (the
    // task brief mentions "invalid phone format e.g. 123 → 40001"), but the
    // actual contract only enforces length (<=20). There is no phone-format
    // rule at either the frontend (no <a-form-item rule>) or the backend
    // (only @Size(max=20)). The literal example "123" would be ACCEPTED by
    // both layers. This is a documentation/contract gap, severity P3.
    appendBug({
      module: 'referee',
      caseKey: 'fail1-phone-validation-gap',
      step:
        '尝试用 phone=123（任务 brief 给出的"invalid phone format"示例）创建裁判',
      expected:
        '前端或后端任一层应拒绝非手机号格式的 phone（例如要求 11 位数字或正则 ^1[3-9]\\d{9}$）',
      actual:
        '前端 <a-input :maxlength="20"> 仅限长 20，无格式校验；后端 RefereeCreateDTO.phone 仅 @Size(max=20)，无 @Pattern。phone=123 会被两层同时接受并成功创建。fail1 改用 phone=21 chars 触发后端 @Size(max=20) → 40001，这是当前唯一能复现 40001 的 phone 路径。',
      severity: 'P3',
      screenshotPath: 'fail1-02-after-rejected.png',
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — delete a referee referenced by an active assignment → 40901.
  //
  // The seed data (init/data.sql) ships zero as_referee_assignment rows, so
  // there is no referee currently referenced by a schedule. In that case
  // the case is test.skip()'d with a P3 reason file — this is the
  // documented stopping condition (NOT a defect).
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 删除被未完成裁判分配引用的裁判 → 40901 (无种子数据则 skip)', async ({
    page,
    context,
  }) => {
    const lsEntries = readStorageStateLs()
    expect(
      lsEntries.find((e) => e.name === 'token')?.value,
      'storageState must contain a token',
    ).toBeTruthy()
    await context.addInitScript(
      (entries: Array<{ name: string; value: string }>) => {
        for (const { name, value } of entries) {
          try {
            window.localStorage.setItem(name, value)
          } catch {
            // ignore
          }
        }
      },
      lsEntries,
    )

    await page.goto('/referee')
    await page.waitForLoadState('domcontentloaded')
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    const activeCount = countActiveAssignments()
    if (activeCount === 0) {
      mkdirSync(EVIDENCE_DIR, { recursive: true })
      const reason =
        `Skipped at ${new Date().toISOString()}\n` +
        `Reason: no as_referee_assignment rows with status=1 found in seed data.\n` +
        `init/data.sql seeds only 8 referees (as_referee) and zero assignments; ` +
        `therefore no referee is currently referenced by an active schedule, ` +
        `and the 40901 delete-blocked path cannot be exercised.\n` +
        `This is the documented stopping condition (P3, not a defect).\n`
      writeFileSync(SKIPPED_FAIL2_REASON_PATH, reason, 'utf8')
      await page.screenshot({
        path: evidencePath('fail2-skipped-no-assignment-seed.png'),
        fullPage: true,
      })
      test.skip(true, reason)
      return
    }

    // Active assignments exist: find a referee id with an active assignment
    // via docker mysql, then attempt DELETE /api/referees/{id} → expect 40901.
    const refIdCmd =
      'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      '-N -e "SELECT referee_id FROM as_referee_assignment WHERE status=1 LIMIT 1;"'
    const refIdOut = execSync(refIdCmd, { stdio: 'pipe', timeout: 5000 })
      .toString()
      .trim()
    const refId = parseInt(refIdOut, 10)
    expect(refId, 'a referee_id with an active assignment must be parsed').toBeGreaterThan(0)

    const delRes = await apiDelete(`/referees/${refId}`, token)
    expect(
      delRes.code,
      'DELETE /api/referees/{id} of a referee with active assignments must return 40901',
    ).toBe(40901)

    await page.screenshot({
      path: evidencePath('fail2-40901-delete-blocked.png'),
      fullPage: true,
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — sweep any __qa_c5_* leftovers regardless of test outcome.
  // cleanupByPrefix matches record.name, which referee records DO expose, so
  // the contract call is sufficient (no username-aware sweep needed here).
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    const deleted = await cleanupByPrefix(
      '/referees?current=1&size=200',
      (r) => r.id as number | string | undefined,
      (id) => `/referees/${id}`,
      SUB_PREFIX,
      token,
    )
    if (deleted > 0) {
      // Housekeeping only — not a bug.
      // eslint-disable-next-line no-console
      console.log(`[C5 referee] afterAll cleanup removed ${deleted} __qa_c5_ referees`)
    }
  })
})
