// ApexSports QA — C7 器材管理模块 spec (equipment)
//
// Covers Docs/07-器材管理模块.md:
//   - GET    /api/equipments          (list, full, filter by type/status)
//   - GET    /api/equipments/{id}     (detail)
//   - POST   /api/equipments          (create, availableQuantity auto = totalQuantity)
//   - PUT    /api/equipments/{id}     (update, totalQuantity 联动 availableQuantity)
//   - DELETE /api/equipments/{id}     (logical delete, blocked by unreturned usage)
//   - Error codes: 40001 / 40101 / 40301 / 40401 / 40901
//
// Execution order is enforced by test.describe.serial. happy1 runs the full
// UI CRUD happy path against /equipment and also asserts the API track to
// verify the response contract. fail1 attempts the brief's literal
// "available > total" create path; since EquipmentCreateDTO excludes the
// availableQuantity field, the API path is impossible — instead we trigger
// 40001 via a negative totalQuantity (@PositiveOrZero violation), and the
// contract gap is documented via appendBug(P3). fail2 attempts a duplicate
// code create; ErrorCode.EQUIPMENT_CODE_EXISTS = 40913 (docs say 40901),
// asserted via [40901, 40913].toContain + appendBug(P2 doc drift).
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent
// CJK chars. 新增器材 renders as 新 增 器 材, 编辑 as 编 辑, 删除 as 删 除,
// 确定 as 确 定, 取消 as 取 消. All Chinese button text is matched with a
// regex that tolerates 0-or-1 whitespace between each char.
import { mkdirSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
import { qaTest, test, expect } from './lib/fixtures'
import {
  apiLogin,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  cleanupByPrefix,
} from './lib/api'
import { STORAGE_STATE_PATH } from './lib/auth'
import { PREFIX, appendBug } from './lib/reporter'

const SUB_PREFIX = PREFIX + 'c7_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-equipment'

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * Hard-delete soft-deleted __qa_% residual rows directly from as_equipment
 * before any test runs.
 *
 * Why this is needed:
 * - as_equipment.code is UNIQUE across the table (the index does NOT include
 *   the deleted column). MyBatis-Plus @TableLogic sets deleted=1 but the row
 *   remains, so the code stays occupied. Re-running happy1 then hits INSERT
 *   __QA_C7_01 → UNIQUE constraint violation → 50000 (same trap as
 *   as_user.uk_username / as_athlete.uk_student_no / as_event.code).
 * - The API list endpoint (GET /api/equipments) filters deleted=1 rows, so
 *   the afterAll cleanupByPrefix sweep cannot see or remove soft-deleted
 *   leftovers. The hard-delete in beforeAll is the only reliable remedy.
 * - Pattern matches only rows whose code OR name starts with __qa_ — the 19
 *   seed equipment rows (发令枪 / START_GUN etc.) are never touched.
 *
 * Fallback: if docker or the mysql CLI is unavailable, the call fails
 * silently with a console.warn and the afterAll API sweep still runs.
 */
function hardCleanupQaEquipment(): void {
  const cmd =
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
    "-e \"DELETE FROM as_equipment WHERE code LIKE '__QA_C7_%' OR name LIKE '__qa_c7_%';\""
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 5000 })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[C7 equipment] hardCleanupQaEquipment failed (docker / mysql unavailable);',
      'falling back to API cleanup in afterAll.',
      err instanceof Error ? err.message : String(err),
    )
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

test.describe.serial('C7 器材管理模块', () => {
  test.beforeAll(async () => {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    hardCleanupQaEquipment()
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy1 — UI CRUD happy path: list >= 19 seed rows, create via UI, API
  // verify, modify totalQuantity via UI (which auto-lowers availableQuantity),
  // delete via UI; screenshot each step.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy1: 器材管理 列表/新增/修改/删除 全流程 (UI + API 双轨)', async ({
    page,
    context,
  }) => {
    // Inject persisted admin localStorage so the SPA router guard sees the
    // token on first navigation (same workaround as C1 happy3 / C5 happy1).
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

    await page.goto('/equipment')
    await page.waitForLoadState('domcontentloaded')

    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    // ── Step 1: list — assert >= 19 seed equipment rows are visible. ──
    await page
      .locator('.ant-table-tbody tr.ant-table-row')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
    const rowCount = await page
      .locator('.ant-table-tbody tr.ant-table-row')
      .count()
    expect(
      rowCount,
      'list must show at least 19 seed equipment rows',
    ).toBeGreaterThanOrEqual(19)

    await page.screenshot({
      path: evidencePath('happy1-01-list.png'),
      fullPage: true,
    })

    // ── Step 2: create __qa_c7_equip_01 (total=10, available=10) via UI. ──
    const newName = SUB_PREFIX + 'equip_01'
    const newCode = '__QA_C7_01'
    // Open the add modal. "新增器材" -> "新 增 器 材" after Ant CJK spacing.
    await page.getByRole('button', { name: /新\s?增\s?器\s?材/ }).click()
    const modal = page.locator('.ant-modal-body')
    await modal.waitFor({ state: 'visible', timeout: 5000 })

    // Form-item label scoping is more robust than getByPlaceholder for
    // Ant Design Vue: a-auto-complete (used for type / unit) places its
    // placeholder on a <span class="ant-select-selection-placeholder">, NOT
    // on the inner <input> — so getByPlaceholder does not match. Locating
    // the input inside the form-item with the matching label works for all
    // field types (a-input / a-auto-complete / a-input-number).
    const formItem = (labelRe: RegExp | string) =>
      modal
        .locator('.ant-form-item')
        .filter({ has: page.locator('label', { hasText: labelRe }) })

    await formItem('器材名称').locator('input').fill(newName)
    await formItem('器材代码').locator('input').fill(newCode)
    await formItem('器材类型').locator('input').fill('田径')
    await formItem('计量单位').locator('input').fill('个')
    // <a-input-number> exposes a native input; fill + press Tab to commit.
    const totalInput = formItem('总数量').locator('input')
    await totalInput.fill('10')
    await totalInput.press('Tab')

    await page.screenshot({
      path: evidencePath('happy1-02-add-form-filled.png'),
      fullPage: true,
    })

    // OK button. "确定" -> "确 定" after Ant CJK spacing.
    await page
      .locator('.ant-modal-footer')
      .getByRole('button', { name: /确\s?定/ })
      .click()
    // Ant Design Vue keeps the closed modal in the DOM (display:none), so
    // waitFor('detached') hangs. Wait for the new row directly — that is
    // the observable outcome of a successful submit.
    // ── Step 3: assert the new row is present in the list (UI track). ──
    const newRow = page
      .locator('.ant-table-tbody tr.ant-table-row')
      .filter({ hasText: newName })
      .first()
    await expect(newRow, 'new equipment row must appear in the list').toBeVisible({
      timeout: 10000,
    })

    await page.screenshot({
      path: evidencePath('happy1-03-created-in-list.png'),
      fullPage: true,
    })

    // ── Step 4: API verify — GET /api/equipments, find by code. ──
    const verifyRes = await apiGet<
      Array<{
        id?: number
        name?: string
        code?: string
        totalQuantity?: number
        availableQuantity?: number
        status?: number
      }>
    >('/equipments', token)
    expect(verifyRes.code, 'GET /api/equipments must return 200').toBe(200)
    expect(Array.isArray(verifyRes.data), 'list data must be an array').toBe(true)
    const created = verifyRes.data?.find((r) => r.code === newCode)
    expect(created, 'API list must contain the freshly created equipment').toBeDefined()
    expect(created?.name, 'created equipment name must match').toBe(newName)
    expect(created?.totalQuantity, 'created totalQuantity must be 10').toBe(10)
    expect(
      created?.availableQuantity,
      'created availableQuantity must auto-equal totalQuantity (10)',
    ).toBe(10)
    expect(created?.status, 'created status must default to 1 (可用)').toBe(1)
    const createdId = created!.id!
    expect(createdId, 'created equipment must have an id').toBeDefined()

    // ── Step 5: modify — change totalQuantity from 10 to 5 via UI. ──
    // Per Docs/07 §41 业务规则: newTotal < oldTotal is allowed iff
    // available - (oldTotal - newTotal) >= 0. With available=10, oldTotal=10,
    // newTotal=5: 10 - 5 = 5 >= 0 → allowed. availableQuantity auto-lowers
    // from 10 to 5.
    await newRow.getByRole('button', { name: /编\s?辑/ }).click()
    const editModal = page.locator('.ant-modal-body')
    await editModal.waitFor({ state: 'visible', timeout: 5000 })

    // a-input-number's v-model does not reliably react to Playwright's fill
    // (which dispatches only `input`). Use the React-style setter + event
    // dispatch pattern to force Vue's v-model to pick up the new value,
    // then press Tab to blur / commit.
    const editTotalInput = editModal
      .locator('.ant-form-item')
      .filter({ has: page.locator('label', { hasText: '总数量' }) })
      .locator('input')
    await editTotalInput.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      setter?.call(el, '5')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('blur', { bubbles: true }))
    })
    await editTotalInput.press('Tab')

    await page.screenshot({
      path: evidencePath('happy1-04-edit-form.png'),
      fullPage: true,
    })

    await page
      .locator('.ant-modal-footer')
      .getByRole('button', { name: /确\s?定/ })
      .click()
    // Ant keeps the closed modal in DOM; wait for the row to reflect the
    // update directly (the observable outcome of a successful submit).
    // ── Step 6: assert the totalQuantity was updated (UI + API). ──
    const updatedRow = page
      .locator('.ant-table-tbody tr.ant-table-row')
      .filter({ hasText: newName })
      .first()
    await expect(updatedRow, 'updated row must still be visible').toBeVisible({
      timeout: 10000,
    })
    await expect(
      updatedRow.filter({ hasText: '5' }),
      'updated row must reflect totalQuantity=5',
    ).toBeVisible()

    const verifyAfterUpdate = await apiGet<
      Array<{
        id?: number
        totalQuantity?: number
        availableQuantity?: number
      }>
    >('/equipments', token)
    const updated = verifyAfterUpdate.data?.find((r) => r.id === createdId)
    expect(
      updated?.totalQuantity,
      'API list must reflect updated totalQuantity=5',
    ).toBe(5)
    expect(
      updated?.availableQuantity,
      'API list must reflect auto-lowered availableQuantity=5 (invariant held)',
    ).toBe(5)

    await page.screenshot({
      path: evidencePath('happy1-05-updated-in-list.png'),
      fullPage: true,
    })

    // ── Step 7: delete via UI — row delete button, then Modal.confirm OK. ──
    await updatedRow.getByRole('button', { name: /删\s?除/ }).click()
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
        .locator('.ant-table-tbody tr.ant-table-row')
        .filter({ hasText: newName }),
      'deleted equipment row must disappear from the list',
    ).toHaveCount(0, { timeout: 10000 })

    // API-side confirmation: GET detail returns 40407 (EQUIPMENT_NOT_FOUND,
    // docs say 40401 — see ErrorCode.java:35).
    const afterDelete = await apiGet('/equipments/' + createdId, token)
    expect(
      [40401, 40407],
      'GET /api/equipments/{id} of a deleted row must return 404xx',
    ).toContain(afterDelete.code)

    await page.screenshot({
      path: evidencePath('happy1-07-deleted-from-list.png'),
      fullPage: true,
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — "available > total" create path → 40001.
  //
  // The brief expects POST /api/equipments with {totalQuantity:5,
  // availableQuantity:10} to surface 40001. EquipmentCreateDTO does NOT
  // expose availableQuantity (per Docs/07 §40 业务规则: availableQuantity
  // is auto-set = totalQuantity by the backend). Spring's default Jackson
  // ObjectMapper silently ignores unknown JSON fields, so this request
  // succeeds with available=5 — the brief's literal path is unreachable.
  //
  // To exercise the documented 40001 path we POST directly via API with
  // totalQuantity = -1 (violates @PositiveOrZero on EquipmentCreateDTO);
  // the global exception handler surfaces 40001. The contract gap is
  // documented via appendBug(P3).
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail1: 器材新增违反数量校验 (available>total 不可达 → 改用 totalQuantity<0) → 40001 (API 轨)', async ({
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

    await page.goto('/equipment')
    await page.waitForLoadState('domcontentloaded')
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    // Open the add modal so the screenshot shows the form context. The
    // totalQuantity input has :min="0", so typing -1 is physically blocked.
    await page.getByRole('button', { name: /新\s?增\s?器\s?材/ }).click()
    const modal = page.locator('.ant-modal-body')
    await modal.waitFor({ state: 'visible', timeout: 5000 })
    await modal.getByPlaceholder('请输入器材名称').fill(SUB_PREFIX + 'fail1_blocked')
    await modal.getByPlaceholder('请输入器材代码').fill('__QA_C7_FAIL1_BL')
    const fail1TotalInput = modal
      .locator('.ant-form-item')
      .filter({ has: page.locator('label', { hasText: '总数量' }) })
      .locator('input')
    await fail1TotalInput.fill('5')
    await page.screenshot({
      path: evidencePath('fail1-01-add-modal.png'),
      fullPage: true,
    })
    // Close the modal without submitting — fail1 asserts the API contract.
    await page
      .locator('.ant-modal-footer')
      .getByRole('button', { name: /取\s?消/ })
      .click()
    // Ant keeps the closed modal in DOM (hidden); proceed to the API track.
    await expect(modal).toBeHidden({ timeout: 5000 })

    // ── Step A: the brief's literal "available > total" path. ──
    // POST with both totalQuantity and an extra availableQuantity field.
    // EquipmentCreateDTO has no availableQuantity setter, so Jackson
    // silently drops it and the backend applies the business rule
    // (available = total = 5). Capture the code to confirm.
    const briefPathRes = await apiPost<{ id?: number }>(
      '/equipments',
      {
        name: SUB_PREFIX + 'fail1_avail_gt_total',
        code: '__QA_C7_FAIL1_AVAIL',
        unit: '个',
        totalQuantity: 5,
        // Extra field the DTO does not declare — should be ignored.
        availableQuantity: 10,
      },
      token,
    )

    let briefPathBlocked = false
    if (briefPathRes.code === 40001) {
      // Some Jackson configs reject unknown fields; either way 40001 is
      // what the brief expected, so the assertion is satisfied directly.
      briefPathBlocked = true
    } else if (briefPathRes.code === 200) {
      // Backend silently dropped availableQuantity; the row was created
      // with available=5. Clean it up immediately so afterAll stays light.
      const leakedId = briefPathRes.data?.id
      if (leakedId !== undefined) {
        await apiDelete('/equipments/' + leakedId, token)
      }
    }

    // ── Step B: deterministic 40001 trigger via @PositiveOrZero violation. ──
    // POST with totalQuantity = -1; backend DTO rejects via Jakarta
    // validation and returns 40001 ("参数校验失败").
    const res = await apiPost<{ id?: number }>(
      '/equipments',
      {
        name: SUB_PREFIX + 'fail1_negative_total',
        code: '__QA_C7_FAIL1_NEG',
        unit: '个',
        totalQuantity: -1,
      },
      token,
    )
    expect(
      res.code,
      'POST /api/equipments with totalQuantity < 0 must return 40001',
    ).toBe(40001)

    // Verify no row was actually created from the rejected request.
    const leftover = await apiGet<Array<{ code?: string }>>(
      '/equipments',
      token,
    )
    expect(
      leftover.data?.find((r) => r.code === '__QA_C7_FAIL1_NEG'),
      'failed-create equipment must not leave a row behind',
    ).toBeUndefined()

    await page.screenshot({
      path: evidencePath('fail1-02-after-rejected.png'),
      fullPage: true,
    })

    // Document the contract gap: the brief's "available > total" create
    // path is unreachable via the API because EquipmentCreateDTO excludes
    // availableQuantity (the field is auto-synced to totalQuantity by the
    // backend). The only deterministic 40001 trigger for create is a
    // @PositiveOrZero / @NotNull / @NotBlank violation. The frontend form's
    // <a-input-number :min="0"> also physically blocks negative input, so
    // the UI cannot reach 40001 for this field either. Severity P3 (docs
    // drift / brief misalignment, not a functional defect).
    if (!briefPathBlocked) {
      appendBug({
        module: 'equipment',
        caseKey: 'fail1-available-gt-total-unreachable',
        step:
          '尝试 POST /api/equipments {totalQuantity:5, availableQuantity:10} 复现 brief 给出的"available>total → 40001"路径',
        expected:
          '后端 EquipmentCreateDTO 应显式拒绝 availableQuantity > totalQuantity 的请求并返回 40001（按 Docs/07 §40 业务规则，availableQuantity 不由客户端控制）',
        actual:
          'EquipmentCreateDTO 未声明 availableQuantity 字段；Spring Jackson 默认忽略未知字段，请求被静默接受并按业务规则 available=total=5 创建成功。fail1 改用 totalQuantity=-1 触发 @PositiveOrZero 校验失败 → 40001（当前唯一可达的 40001 create 路径）。',
        severity: 'P3',
        screenshotPath: 'fail1-02-after-rejected.png',
      })
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — duplicate code create → 40901 (docs) / 40913 (actual).
  //
  // ErrorCode.EQUIPMENT_CODE_EXISTS = 40913 (ErrorCode.java:56), NOT 40901
  // as documented in Docs/07 §40. The spec asserts [40901, 40913] so both
  // the doc contract and the actual backend behavior are accepted, and the
  // drift is reported via appendBug(P2).
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 器材新增 code 重复 → 40913 (docs 标 40901) (API 轨)', async ({
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

    await page.goto('/equipment')
    await page.waitForLoadState('domcontentloaded')
    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    // Use a known seed code as the duplicate target. data.sql:88 seeds
    // 'START_GUN' for 发令枪. Reusing the seed code guarantees the conflict
    // regardless of any prior test runs (the hard-delete sweep in beforeAll
    // matches __QA_C7_%, never START_GUN).
    const dupCode = 'START_GUN'

    const res = await apiPost<{ id?: number }>(
      '/equipments',
      {
        name: SUB_PREFIX + 'fail2_dup_code',
        code: dupCode,
        unit: '个',
        totalQuantity: 1,
      },
      token,
    )
    expect(
      [40901, 40913],
      'POST /api/equipments with an existing code must return 40901 (docs) or 40913 (EQUIPMENT_CODE_EXISTS)',
    ).toContain(res.code)

    // Verify no row was created (the rejection must be atomic).
    const leftover = await apiGet<Array<{ name?: string }>>(
      '/equipments',
      token,
    )
    expect(
      leftover.data?.find((r) => r.name === SUB_PREFIX + 'fail2_dup_code'),
      'failed-create equipment must not leave a row behind',
    ).toBeUndefined()

    await page.screenshot({
      path: evidencePath('fail2-01-dup-code-rejected.png'),
      fullPage: true,
    })

    // Document the docs ↔ ErrorCode.java drift. P2 because it's a
    // documentation defect, not a functional one.
    appendBug({
      module: 'equipment',
      caseKey: 'fail2-dup-code-error-code-drift',
      step:
        'POST /api/equipments 复用种子 code "START_GUN" 创建器材，断言返回码',
      expected: 'Docs/07 §40 标注器材代码已存在 = 40901',
      actual:
        'ErrorCode.EQUIPMENT_CODE_EXISTS = 40913（ErrorCode.java:56）；40901 已被 USERNAME_EXISTS 占用。Spec 用 [40901, 40913].toContain 兼容两种契约。',
      severity: 'P2',
      screenshotPath: 'fail2-01-dup-code-rejected.png',
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — sweep any __qa_c7_* leftovers regardless of test outcome.
  // cleanupByPrefix matches record.name ?? record.code. Equipment records
  // expose BOTH name (e.g. "__qa_c7_equip_01") and code (e.g. "__QA_C7_01"),
  // but the SUB_PREFIX is lowercase "__qa_c7_" which matches record.name.
  // The list endpoint returns an ARRAY (not paged), which cleanupByPrefix
  // handles transparently.
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    const deleted = await cleanupByPrefix(
      '/equipments',
      (r) => r.id as number | string | undefined,
      (id) => `/equipments/${id}`,
      SUB_PREFIX,
      token,
    )
    if (deleted > 0) {
      // Housekeeping only — not a bug.
      // eslint-disable-next-line no-console
      console.log(
        `[C7 equipment] afterAll cleanup removed ${deleted} __qa_c7_ equipment rows`,
      )
    }
  })
})
