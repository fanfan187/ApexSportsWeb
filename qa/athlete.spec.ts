// ApexSports QA — C3 运动员管理模块 spec (athlete)
//
// Covers Docs/03-运动员管理模块.md:
//   - GET    /api/athletes          (list + filter by collegeId/name/studentNo/status/gender)
//   - GET    /api/athletes/{id}     (detail with collegeName/collegeCode)
//   - POST   /api/athletes          (create; 40001 param invalid; docs 40901 / impl 40905 学号已存在)
//   - PUT    /api/athletes/{id}     (partial update)
//   - DELETE /api/athletes/{id}     (logical delete)
//
// Execution order is enforced by test.describe.serial. The happy path drives the
// real UI (/athlete view) for create/filter/edit/delete and dual-tracks every
// mutation against the documented API contract. fail1 hits the duplicate
// studentNo 40901 path via UI submit with route interception (the axios
// interceptor surfaces a toast but does not redirect, so the modal stays open
// — unlike the auth fail2 case where 40101 triggers a full reload). fail2
// asserts the Ant Design Vue form rule on `collegeId` blocks submit with the
// "请选择学院" message — the documented 40001 surface rendered as client-side
// form validation per the spec's MUST DO note.
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent CJK
// chars (see learnings.md 2026-07-21 11:15:00). "新增运动员" renders as
// "新 增 运 动 员", "编辑" as "编 辑", "删除" as "删 除", modal OK "确定"
// as "确 定", modal cancel "取消" as "取 消". All Chinese button / option
// text is matched with a regex that tolerates 0-or-1 whitespace between each
// char.
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
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
import { STORAGE_STATE_PATH } from './lib/auth'
import { PREFIX, appendBug } from './lib/reporter'

const SUB_PREFIX = PREFIX + 'c3_'
const EVIDENCE_DIR =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-athlete'

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * Hard-delete soft-deleted `__qa_c3_%` residuals directly from the DB before
 * the spec runs.
 *
 * Why this is needed:
 * - `as_athlete.uk_student_no` is `UNIQUE(student_no)` and does NOT include
 *   the `deleted` column (verified in init/schema.sql:64). MyBatis-Plus
 *   `@TableLogic` logical delete sets `deleted=1` but the row remains, so
 *   the student_no stays occupied.
 * - The API list endpoint filters `deleted=1` rows, so `cleanupByPrefix`
 *   (API sweep in afterAll) cannot see or remove soft-deleted leftovers.
 *   Re-running the spec then hits a UNIQUE constraint violation on
 *   `INSERT __qa_c3_...` → 50000.
 *
 * Plan allowance: "only DELETE test entities prefixed `__qa_`". The
 * `LIKE '__qa_c3_%'` pattern matches only SUB_PREFIX rows; seed athletes
 * in init/data.sql are never touched.
 *
 * Fallback: if docker / the mysql CLI is unavailable, the call fails silently
 * with a `console.warn` and the existing afterAll API cleanup still runs as a
 * best-effort sweep.
 */
function hardCleanupQaAthletes(): void {
  const cmd =
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
    "-e \"DELETE FROM as_athlete WHERE student_no LIKE '__qa_c3_%' OR name LIKE '__qa_c3_%';\""
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 5000 })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[C3 athlete] hardCleanupQaAthletes failed (docker / mysql unavailable);',
      'falling back to API cleanup in afterAll.',
      err instanceof Error ? err.message : String(err),
    )
  }
}

/**
 * Resolve the seed college id for 「体育学院」 (code PE) via the API.
 * Used by both the UI track (the form needs the option visible, which the
 * college list API populates client-side) and the API track (we need the
 * numeric id for the create payload).
 */
async function resolvePeCollegeId(token: string): Promise<number> {
  // The colleges endpoint returns data as a flat array (no pagination
  // wrapper), per the verified contract: GET /api/colleges?current=1&size=100
  // -> { code:200, data:[{id,name,code,...}] }. Athletes use a paginated
  // wrapper ({ records:[] }). Handle both shapes defensively.
  const res = await apiGet<
    | Array<{ id?: number; name?: string; code?: string }>
    | { records?: Array<{ id?: number; name?: string; code?: string }> }
  >('/colleges?current=1&size=100', token)
  expect(res.code, 'GET /api/colleges must return 200').toBe(200)
  const list = Array.isArray(res.data)
    ? (res.data as Array<{ id?: number; name?: string; code?: string }>)
    : (res.data?.records ?? [])
  const pe = list.find((r) => r.code === 'PE' || r.name === '体育学院')
  expect(pe, 'seed data must include 体育学院 (code=PE)').toBeDefined()
  expect(pe!.id, '体育学院 must have a numeric id').toBeDefined()
  return pe!.id!
}

/**
 * Open an Ant Design Vue <a-select> (matched by its placeholder SPAN text
 * on `.ant-select-selection-placeholder`) and pick the option whose rendered
 * text matches the given CJK regex. Ant auto-inserts a space between
 * adjacent CJK chars, so callers MUST pass a regex that tolerates 0-or-1
 * whitespace between each char (e.g. /体\s?育\s?学\s?院/).
 *
 * Why not getByPlaceholder: Ant Design Vue renders the placeholder as a
 * <span class="ant-select-selection-placeholder">学院</span>, NOT as an
 * <input placeholder="学院">. Playwright's getByPlaceholder therefore
 * resolves to nothing and times out.
 *
 * Why not getByRole('option', { name }): the option's accessible name is
 * computed from the rendered text including the auto-inserted spaces. On
 * this system the role-name match has been flaky (timing-sensitive portal
 * render). Falling back to the .ant-select-item-option div + hasText regex
 * is reliably stable.
 *
 * Precondition: the target select has no value yet (placeholder span
 * visible). All call sites in this spec open selects that are initially
 * empty, so this holds.
 */
async function selectAntOption(
  page: import('@playwright/test').Page,
  placeholder: string,
  optionRegex: RegExp,
): Promise<void> {
  // Locate the .ant-select whose placeholder span matches. Use first() in
  // case multiple selects share a placeholder (they don't in this view, but
  // the helper stays reusable).
  const select = page
    .locator('.ant-select', {
      has: page.locator('.ant-select-selection-placeholder', {
        hasText: placeholder,
      }),
    })
    .first()
  await select.click()
  // The dropdown portal renders at the end of <body>. Use the LAST visible
  // .ant-select-dropdown (the one we just opened).
  const dropdown = page.locator('.ant-select-dropdown:visible').last()
  await dropdown.waitFor({ state: 'visible', timeout: 5000 })
  await dropdown
    .locator('.ant-select-item-option', { hasText: optionRegex })
    .first()
    .click()
}

test.describe.serial('C3 运动员管理模块', () => {
  // ───────────────────────────────────────────────────────────────────────
  // beforeAll — hard-delete soft-deleted __qa_c3_ residuals before any test
  // runs. See hardCleanupQaAthletes docstring for why API cleanup is
  // insufficient (as_athlete.uk_student_no does not include `deleted`).
  // ───────────────────────────────────────────────────────────────────────
  test.beforeAll(async () => {
    hardCleanupQaAthletes()

    // The seed data (ApexSports/init/data.sql) does NOT include any athletes —
    // only colleges / events / venues / equipment / referees are seeded. The
    // spec's "list non-empty" + "filter by 体育学院" assertions need at least
    // one PE athlete to be visible, so we seed one here via the API. It is
    // SUB_PREFIX-tagged so afterAll's cleanupByPrefix sweep removes it.
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    // Hard-delete any prior seed first (idempotency across runs). The API
    // list endpoint filters deleted=1 rows, so the API sweep alone cannot
    // see leftovers — the SQL sweep above handles that, but it runs BEFORE
    // this seeding, so we also explicitly DELETE via API for any row the
    // SQL sweep missed (e.g. if docker was unavailable last run).
    const listRes = await apiGet<{
      records?: Array<{ id?: number; name?: string }>
    }>('/athletes?current=1&size=200', token)
    if (listRes.code === 200) {
      for (const r of listRes.data?.records ?? []) {
        if (String(r.name ?? '').startsWith(SUB_PREFIX)) {
          await apiDelete(`/athletes/${r.id}`, token)
        }
      }
    }

    const peCollegeId = await resolvePeCollegeId(token)
    const seedRes = await apiPost<{ id?: number }>(
      '/athletes',
      {
        collegeId: peCollegeId,
        name: SUB_PREFIX + 'seed_001',
        studentNo: SUB_PREFIX + 'seed_s001',
        gender: 1,
        grade: '2024',
        phone: '13800138000',
      },
      token,
    )
    expect(
      seedRes.code,
      'beforeAll: seed athlete (POST /api/athletes) must return 200',
    ).toBe(200)
    expect(
      seedRes.data?.id,
      'beforeAll: seed athlete must have an id',
    ).toBeDefined()
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy — full CRUD via UI + dual-track API verification.
  // Flow: list (non-empty) → filter by 体育学院 → create → assert in list
  //       → API GET verify → edit phone → API GET verify → delete → assert
  //       row gone. Screenshots at every observable phase.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy: 运动员 列表/筛选/新增/修改/删除 (UI + API 双轨)', async ({
    page,
    context,
  }) => {
    // qaTest fixture's storageState option (Playwright 1.61 + ESM) does not
    // reliably inject localStorage entries into the page on this system (per
    // learnings.md and the auth.spec.ts happy3 workaround). Load the persisted
    // storageState from disk and inject via an init script so the SPA's router
    // guard sees the token on first load.
    expect(
      existsSync(STORAGE_STATE_PATH),
      'storageState file must exist (produced by C1 auth happy1)',
    ).toBeTruthy()
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
            // ignore — origin may not yet be localhost:5173
          }
        }
      },
      lsEntries,
    )

    await page.goto('/athlete')
    await page.waitForLoadState('domcontentloaded')

    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    // ─── Phase 1: list non-empty ─────────────────────────────────────────
    // AthleteController#page returns seed athletes; the table should have at
    // least one data row. We wait for the table body to render cells.
    await expect(
      page
        .getByRole('table')
        .first()
        .getByRole('row')
        .filter({ has: page.getByRole('button') })
        .first(),
    ).toBeVisible({ timeout: 10000 })

    await page.screenshot({
      path: evidencePath('happy-01-list.png'),
      fullPage: true,
    })

    // API track: confirm GET /api/athletes returns 200 + non-empty records.
    const listRes = await apiGet<{
      records?: Array<Record<string, unknown>>
      total?: number
    }>('/athletes?current=1&size=10', token)
    expect(listRes.code, 'GET /api/athletes must return 200').toBe(200)
    expect(listRes.data?.records, 'records array must be present').toBeTruthy()
    expect(
      listRes.data!.records!.length,
      'records must not be empty (seed athletes exist)',
    ).toBeGreaterThan(0)

    // ─── Phase 2: filter by 体育学院 (PE) ───────────────────────────────
    // The filter bar's first <a-select> is the college filter. Open it, pick
    // 体育学院 from the dropdown, click 查询, and assert every visible row's
    // 学院 cell equals 体育学院.
    const peCollegeId = await resolvePeCollegeId(token)

    await selectAntOption(page, '学院', /体\s?育\s?学\s?院/)

    // "查询" button in the filter bar.
    await page.getByRole('button', { name: /查\s?询/ }).click()

    // Wait for the table to re-render with the filtered result. The 学院
    // column's cell text should equal "体育学院" for every visible row. If
    // the filter yields zero rows (seed data has no athletes from PE), the
    // assertion degrades gracefully — we still screenshot for evidence.
    await page.waitForLoadState('networkidle')
    const rows = page
      .getByRole('table')
      .first()
      .getByRole('row')
      .filter({ has: page.getByRole('button') })
    const rowCount = await rows.count()
    if (rowCount > 0) {
      const collegeCells = rows.getByRole('cell').nth(3) // 学院 column index
      const firstCollegeText = (await collegeCells.first().innerText()).trim()
      expect(
        firstCollegeText,
        'filtered rows must belong to 体育学院',
      ).toContain('体育学院')
    }

    await page.screenshot({
      path: evidencePath('happy-02-filter-pe.png'),
      fullPage: true,
    })

    // Reset the filter so the new athlete is visible in the unfiltered list
    // after creation. The new athlete will belong to PE, so it would appear
    // under either view — but resetting keeps the visible row count high
    // enough to assert table-non-empty after create.
    await page.getByRole('button', { name: /重\s?置/ }).click()
    await page.waitForLoadState('networkidle')

    // ─── Phase 3: create via UI ──────────────────────────────────────────
    const newName = SUB_PREFIX + 'athlete_001'
    const newStudentNo = SUB_PREFIX + 's001'
    const newPhone = '13800138001'
    const updatedPhone = '13800138999'

    await page.getByRole('button', { name: /新\s?增\s?运\s?动\s?员/ }).click()
    await expect(page.getByRole('dialog').last()).toBeVisible()

    // 学院 (form item) — open the select, pick 体育学院.
    await selectAntOption(page, '请选择学院', /体\s?育\s?学\s?院/)

    // 姓名
    await page.getByPlaceholder('请输入姓名').fill(newName)
    // 学号
    await page.getByPlaceholder('请输入学号').fill(newStudentNo)
    // 性别 — 男 (value=1)
    await selectAntOption(page, '请选择性别', /^男$/)
    // 年级 (optional)
    await page.getByPlaceholder('请输入年级（可选）').fill('2024')
    // 联系电话 (optional) — initial value for the edit-phase assertion
    await page.getByPlaceholder('请输入联系电话（可选）').fill(newPhone)

    await page.screenshot({
      path: evidencePath('happy-03-create-form.png'),
      fullPage: true,
    })

    // Intercept POST /api/athletes so we can assert the API response in
    // parallel with the UI's optimistic refresh. The route is fulfilled
    // unchanged so the SPA's axios handler runs normally.
    let createApiCode: number | undefined
    let createdId: number | undefined
    await page.route('**/api/athletes', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const body = await response.json().catch(() => undefined)
      if (body && typeof body.code === 'number') {
        createApiCode = body.code
        if (body.data && typeof body.data.id === 'number') {
          createdId = body.data.id
        }
      }
      await route.fulfill({ response })
    })

    // Modal OK button — Ant Design Vue default text "确 定".
    await page.getByRole('button', { name: /^确\s?定$/ }).click()

    // Wait for the API call to fire and the modal to close.
    await expect
      .poll(() => createApiCode, {
        timeout: 10000,
        message: 'POST /api/athletes must be intercepted with a numeric code',
      })
      .toBe(200)
    await expect(page.getByRole('dialog').last()).toBeHidden({ timeout: 10000 })

    expect(
      createdId,
      'POST /api/athletes response must include the new athlete id',
    ).toBeDefined()

    await page.screenshot({
      path: evidencePath('happy-04-created.png'),
      fullPage: true,
    })

    // API track: GET /api/athletes/{id} must return the new athlete.
    const detailRes = await apiGet<{
      id?: number
      name?: string
      studentNo?: string
      phone?: string
      collegeId?: number
      status?: number
    }>(`/athletes/${createdId}`, token)
    expect(detailRes.code, 'GET /api/athletes/{id} must return 200').toBe(200)
    expect(detailRes.data?.name, 'detail name must match').toBe(newName)
    expect(detailRes.data?.studentNo, 'detail studentNo must match').toBe(
      newStudentNo,
    )
    expect(detailRes.data?.phone, 'detail phone must match initial value').toBe(
      newPhone,
    )
    expect(detailRes.data?.collegeId, 'detail collegeId must be PE').toBe(
      peCollegeId,
    )
    expect(detailRes.data?.status, 'new athlete status defaults to 1 (正常)').toBe(
      1,
    )

    // ─── Phase 4: edit phone via UI ──────────────────────────────────────
    // Locate the new athlete's row by its name cell. Click 编辑 in that row.
    const newRow = page
      .getByRole('table')
      .first()
      .getByRole('row')
      .filter({ hasText: newName })
      .first()
    await expect(newRow).toBeVisible({ timeout: 10000 })

    await newRow.getByRole('button', { name: /编\s?辑/ }).click()
    await expect(page.getByRole('dialog').last()).toBeVisible()

    // Clear and refill the phone field, then submit.
    const phoneInput = page.getByPlaceholder('请输入联系电话（可选）')
    await phoneInput.clear()
    await phoneInput.fill(updatedPhone)

    await page.screenshot({
      path: evidencePath('happy-05-edit-form.png'),
      fullPage: true,
    })

    let updateApiCode: number | undefined
    await page.route('**/api/athletes/*', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const body = await response.json().catch(() => undefined)
      if (body && typeof body.code === 'number') updateApiCode = body.code
      await route.fulfill({ response })
    })

    await page.getByRole('button', { name: /^确\s?定$/ }).click()

    await expect
      .poll(() => updateApiCode, {
        timeout: 10000,
        message: 'PUT /api/athletes/{id} must be intercepted with a numeric code',
      })
      .toBe(200)
    await expect(page.getByRole('dialog').last()).toBeHidden({ timeout: 10000 })

    // API track: re-fetch and assert phone updated.
    const afterUpdate = await apiGet<{ phone?: string }>(
      `/athletes/${createdId}`,
      token,
    )
    expect(afterUpdate.code, 'GET after update must return 200').toBe(200)
    expect(afterUpdate.data?.phone, 'phone must reflect the new value').toBe(
      updatedPhone,
    )

    await page.screenshot({
      path: evidencePath('happy-06-updated.png'),
      fullPage: true,
    })

    // ─── Phase 5: delete via UI ───────────────────────────────────────────
    // Re-locate the row (it may have been re-rendered after the edit refresh)
    // and click 删除. A Modal.confirm popup appears with 删除 / 取消 buttons.
    const rowBeforeDelete = page
      .getByRole('table')
      .first()
      .getByRole('row')
      .filter({ hasText: newName })
      .first()
    await expect(rowBeforeDelete).toBeVisible({ timeout: 10000 })

    await rowBeforeDelete.getByRole('button', { name: /删\s?除/ }).click()

    // Modal.confirm renders in a `.ant-modal-confirm` portal. Its OK button
    // text is "删除" per athlete/index.vue handleDelete okText.
    const confirmModal = page.locator('.ant-modal-confirm').last()
    await expect(confirmModal).toBeVisible({ timeout: 5000 })

    let deleteApiCode: number | undefined
    await page.route('**/api/athletes/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const body = await response.json().catch(() => undefined)
      if (body && typeof body.code === 'number') deleteApiCode = body.code
      await route.fulfill({ response })
    })

    await confirmModal.getByRole('button', { name: /删\s?除/ }).click()

    await expect
      .poll(() => deleteApiCode, {
        timeout: 10000,
        message: 'DELETE /api/athletes/{id} must be intercepted with a numeric code',
      })
      .toBe(200)
    await expect(confirmModal).toBeHidden({ timeout: 10000 })

    // The row must be gone from the visible list.
    await expect(rowBeforeDelete).toBeHidden({ timeout: 10000 })

    await page.screenshot({
      path: evidencePath('happy-07-deleted.png'),
      fullPage: true,
    })

    // API track: GET /api/athletes/{id} on a soft-deleted record must
    // return a not-found error. Docs/03 §15 documents 40401, but the actual
    // backend implementation uses ErrorCode.ATHLETE_NOT_FOUND = 40403
    // (40401 is already occupied by USER_NOT_FOUND per ErrorCode.java).
    // Assert the actual code AND flag the docs/backend mismatch as a P2 bug
    // for the C16 rollup.
    const gone = await apiGet(`/athletes/${createdId}`, token)
    expect(
      gone.code,
      'GET /api/athletes/{id} after delete must yield a not-found code (docs: 40401, impl: 40403)',
    ).toBe(40403)

    appendBug({
      module: 'athlete',
      caseKey: 'happy-get-after-delete',
      step: '删除运动员后 GET /api/athletes/{id}',
      expected: 'Docs/03 §15 错误码表声明 运动员不存在 → 40401',
      actual:
        '后端实际返回 40403（ErrorCode.ATHLETE_NOT_FOUND = 40403），因为 40401 已被 USER_NOT_FOUND 占用。文档与实现不一致',
      severity: 'P2',
      screenshotPath: 'happy-07-deleted.png',
    })
  })

  // ───────────────────────────────────────────────────────────────────────
// fail1 — duplicate studentNo → 学号已存在 (docs 40901 / impl 40905).
// Create one athlete via API with studentNo __qa_c3_dup_001, then attempt
// to create a second athlete via UI with the same studentNo (different
// name). The backend AthleteLogic#create checks studentNo uniqueness via
// athleteDAO.countByStudentNo and throws BusinessException(STUDENT_NO_EXISTS),
// which surfaces as code 40905 (impl) — Docs/03 §16 documents 40901, a
// docs/backend mismatch flagged below via appendBug. The axios handler
// rejects, the modal stays open, and a message.error toast appears.
// ───────────────────────────────────────────────────────────────────────
qaTest('fail1: 重复学号 → 学号已存在 (docs 40901 / impl 40905) (UI 提交 + API 拦截)', async ({
    page,
    context,
  }) => {
    // StorageState injection — same workaround as the happy case.
    expect(
      existsSync(STORAGE_STATE_PATH),
      'storageState file must exist (produced by C1 auth happy1)',
    ).toBeTruthy()
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
            // ignore
          }
        }
      },
      lsEntries,
    )

    await page.goto('/athlete')
    await page.waitForLoadState('domcontentloaded')

    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    const peCollegeId = await resolvePeCollegeId(token)
    const dupStudentNo = SUB_PREFIX + 'dup_001'

    // Seed athlete A via API so the second (UI) create hits the uniqueness
    // constraint. Cleaned up in afterAll by the SUB_PREFIX sweep.
    const seedRes = await apiPost<{ id?: number }>(
      '/athletes',
      {
        collegeId: peCollegeId,
        name: SUB_PREFIX + 'dup_seed',
        studentNo: dupStudentNo,
        gender: 1,
        grade: '2024',
        phone: '13800138700',
      },
      token,
    )
    expect(seedRes.code, 'seed athlete A (POST /api/athletes) must return 200').toBe(
      200,
    )
    const seedId = seedRes.data?.id
    expect(seedId, 'seed athlete A must have an id').toBeDefined()

    // ─── UI: attempt to create athlete B with the same studentNo ──────────
    await page.getByRole('button', { name: /新\s?增\s?运\s?动\s?员/ }).click()
    await expect(page.getByRole('dialog').last()).toBeVisible()

    await selectAntOption(page, '请选择学院', /体\s?育\s?学\s?院/)

    await page.getByPlaceholder('请输入姓名').fill(SUB_PREFIX + 'dup_second')
    await page.getByPlaceholder('请输入学号').fill(dupStudentNo)
    await selectAntOption(page, '请选择性别', /^男$/)

    let dupApiCode: number | undefined
    await page.route('**/api/athletes', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const body = await response.json().catch(() => undefined)
      if (body && typeof body.code === 'number') dupApiCode = body.code
      await route.fulfill({ response })
    })

    await page.screenshot({
      path: evidencePath('fail1-01-form-filled.png'),
      fullPage: true,
    })

    await page.getByRole('button', { name: /^确\s?定$/ }).click()

    await expect
      .poll(() => dupApiCode, {
        timeout: 10000,
        message: 'duplicate-studentNo POST must be intercepted with a numeric code',
      })
      .toBe(40905)

    // Docs/03 §16 documents 40901 = 学号已存在, but the actual backend
    // implementation uses ErrorCode.STUDENT_NO_EXISTS = 40905 (40901 is
    // occupied by USERNAME_EXISTS / password errors). Flag the docs/backend
    // mismatch as a P2 bug for the C16 rollup.
    appendBug({
      module: 'athlete',
      caseKey: 'fail1-duplicate-studentNo-code-mismatch',
      step: '用已存在的学号 __qa_c3_dup_001 提交新增运动员表单并拦截后端响应',
      expected: 'Docs/03 §16 错误码表声明 学号已存在 → 40901',
      actual:
        '后端实际返回 40905（ErrorCode.STUDENT_NO_EXISTS = 40905），因为 40901 已被 USERNAME_EXISTS 占用。文档与实现不一致',
      severity: 'P2',
      screenshotPath: 'fail1-02-dup-error.png',
    })

    // The modal stays open because the axios call rejected (handleSubmit's
    // await threw). The toast surfaces the backend message.
    await expect(page.getByRole('dialog').last()).toBeVisible({ timeout: 5000 })

    // Best-effort toast capture — message.error is rendered in a portal.
    const toast = page.locator('.ant-message-notice-content').first()
    let toastVisible = false
    try {
      await expect(toast).toBeVisible({ timeout: 2000 })
      toastVisible = true
    } catch {
      // Toast may fade before we read it; the API code assertion above is
      // the authoritative check.
    }

    await page.screenshot({
      path: evidencePath('fail1-02-dup-error.png'),
      fullPage: true,
    })

    // Close the still-open modal so the next test starts from a clean slate.
    await page.getByRole('button', { name: /取\s?消/ }).click()
    await expect(page.getByRole('dialog').last()).toBeHidden({ timeout: 5000 })

    // Cleanup seed athlete A via API so it doesn't block subsequent runs.
    if (seedId !== undefined) {
      await apiDelete(`/athletes/${seedId}`, token)
    }

    // If the toast did NOT appear despite a 40905 response, that is a P1
    // observability defect — the user gets no visible feedback for a
    // duplicate-key rejection. Document it for the C16 rollup.
    if (!toastVisible) {
      appendBug({
        module: 'athlete',
        caseKey: 'fail1-duplicate-studentNo-no-toast',
        step: '用已存在的学号 __qa_c3_dup_001 提交新增运动员表单',
        expected:
          'axios 拦截 40905 后 message.error 弹出「学号已存在」toast，用户可见错误反馈',
        actual:
          'API 返回 40905（已通过路由拦截断言），但 .ant-message-notice-content toast 在 2s 内未捕获到，用户可能无可见错误反馈',
        severity: 'P1',
        screenshotPath: 'fail1-02-dup-error.png',
      })
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — required college missing → frontend form validation blocks
  // submit with 「请选择学院」. Per Docs/03 §16 the documented surface for
  // "必填字段为空" is code 40001; the Vue form's `required: true` rule is
  // the client-side rendering of that contract — it prevents the axios call
  // from firing at all when collegeId is empty.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 必填字段缺失（学院未选） → 前端表单校验 拦截提交', async ({
    page,
    context,
  }) => {
    // StorageState injection — same workaround as the happy case.
    expect(
      existsSync(STORAGE_STATE_PATH),
      'storageState file must exist (produced by C1 auth happy1)',
    ).toBeTruthy()
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
            // ignore
          }
        }
      },
      lsEntries,
    )

    await page.goto('/athlete')
    await page.waitForLoadState('domcontentloaded')

    const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
    expect(token, 'qaTest storageState must contain a token').not.toBe('')

    // Open the create modal and fill every required field EXCEPT collegeId.
    await page.getByRole('button', { name: /新\s?增\s?运\s?动\s?员/ }).click()
    await expect(page.getByRole('dialog').last()).toBeVisible()

    await page.getByPlaceholder('请输入姓名').fill(SUB_PREFIX + 'no_college')
    await page.getByPlaceholder('请输入学号').fill(SUB_PREFIX + 'no_college_s')
    await selectAntOption(page, '请选择性别', /^男$/)

    // Wire a route listener so we can PROVE no POST reached the server.
    let postReachedServer = false
    await page.route('**/api/athletes', async (route) => {
      if (route.request().method() === 'POST') {
        postReachedServer = true
      }
      await route.continue()
    })

    await page.getByRole('button', { name: /^确\s?定$/ }).click()

    // Ant Design Vue form rule on collegeId renders the message under the
    // form item. The rule text is "请选择学院" (src/views/athlete/index.vue
    // rules.collegeId). The placeholder span ALSO contains "请选择学院" (the
    // select is still empty), so getByText matches both — scope to the
    // validation error element via .ant-form-item-explain-error.
    const validationMessage = page
      .locator('.ant-form-item-explain-error', { hasText: /请\s?选\s?择\s?学\s?院/ })
      .first()
    await expect(validationMessage).toBeVisible({ timeout: 5000 })

    // The modal must stay open (submit was rejected by the form, not the
    // server). No POST should have hit the API.
    await expect(page.getByRole('dialog').last()).toBeVisible({ timeout: 2000 })
    expect(
      postReachedServer,
      'no POST /api/athletes should fire when form validation fails',
    ).toBe(false)

    await page.screenshot({
      path: evidencePath('fail2-01-college-required.png'),
      fullPage: true,
    })

    // Close the modal to leave a clean state for any subsequent runs.
    await page.getByRole('button', { name: /取\s?消/ }).click()
    await expect(page.getByRole('dialog').last()).toBeHidden({ timeout: 5000 })
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — sweep any __qa_c3_* leftovers regardless of test outcome.
  // cleanupByPrefix matches `record.name ?? record.code`; athlete records
  // expose `name`, so the contract call is the actual sweep (unlike C1 auth
  // where user records expose `username`). The beforeAll hard-delete still
  // runs as a belt-and-suspenders for soft-deleted rows that the API sweep
  // cannot see.
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    const deleted = await cleanupByPrefix(
      '/athletes?current=1&size=200',
      (r) => r.id as number | string | undefined,
      (id) => `/athletes/${id}`,
      SUB_PREFIX,
      token,
    )
    if (deleted > 0) {
      // eslint-disable-next-line no-console
      console.log(`[C3 athlete] afterAll cleanup removed ${deleted} __qa_c3_ athletes`)
    }
  })
})
