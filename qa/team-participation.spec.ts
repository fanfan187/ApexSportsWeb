// ApexSports QA — C9 团体报名模块 spec (team-participation)
//
// Covers Docs/08-报名模块.md (团体部分):
//   - GET    /api/team-participations          (list, paginated)
//   - GET    /api/team-participations/{id}     (detail)
//   - POST   /api/team-participations          (create, admin only)
//   - DELETE /api/team-participations/{id}     (logical delete, admin only)
//   - Error codes (Docs/08 §48): 40001 / 40401 / 40901 (doc) — backend
//     ErrorCode enum returns 40934 (COLLEGE_EVENT_DUPLICATE) for the duplicate
//     case and 40933 (PARTICIPANT_COUNT_EXCEEDED) for over-limit. Doc/code
//     drift is documented via appendBug (P2). See fail1 and fail2.
//
// BRIEF DEVIATION (documented):
//   The brief asks the spec to "create 4 __qa_c9_athlete_* athletes" as part
//   of the happy-path setup. The team_participation API explicitly does NOT
//   track athlete identities — Docs/08 §48 业务规则 states "不记录具体运动员
//   姓名，仅记录学院和参赛人数". The TeamParticipationCreateDTO only carries
//   { collegeId, eventId, participantCount }. Creating 4 athlete rows would
//   therefore be dead data with zero test value for this module, and would
//   re-introduce the as_athlete.uk_student_no UNIQUE-soft-delete trap
//   unnecessarily. This spec deviates: it uses participantCount=4 to
//   represent the 4-member team (the only field the API actually stores).
//   Logged via appendBug at severity P3 (brief gap, not a code defect).
//
// Layout:
//   - beforeAll: hard-delete __qa_c9_% rows from as_team_participation,
//     as_event, as_college (FK-safe order: child first). as_team_participation
//     has no natural-key UNIQUE so soft-delete does not trap re-runs, but
//     we sweep anyway so re-runs start clean and the list-baseline assertion
//     (no __qa_c9_ rows visible) holds.
//   - happy: API setup (1 test college + 1 type=2 team event with
//     maxParticipants=4) → goto /registration/team → create team registration
//     via UI form (学院 + 集体项目 + 参赛人数=4) → assert row appears in list →
//     API GET list verify → API GET by id verify → UI delete via 取消 row
//     button + Modal.confirm 取消报名 → assert row gone → API GET verify gone.
//   - fail1: API POST participantCount=0 → @Min(1) violation → 40001.
//     The brief's "3 athletes for a 4-person event" path is unreachable
//     (3 ≤ 4 satisfies the only validation, @Min(1)/≤max). Documented via
//     appendBug P3.
//   - fail2: API POST twice with same collegeId+eventId → second call
//     returns 40934 (COLLEGE_EVENT_DUPLICATE). Docs/08 §48 lists 40901.
//     Assert [40901, 40934].toContain(code); appendBug P2 (doc drift).
//
// CJK button labels: Ant Design Vue auto-inserts a space between adjacent
// CJK chars. "新增集体参赛" renders as "新 增 集 体 参 赛", "取消" as "取 消",
// "取消报名" as "取 消 报 名", "确定" as "确 定". All Chinese button text is
// matched with a regex tolerating 0-or-1 whitespace per char.
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
import type { BrowserContext, Locator, Page } from '@playwright/test'
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

const SUB_PREFIX = PREFIX + 'c9_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-team-participation'

mkdirSync(EVIDENCE_DIR, { recursive: true })

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * Hard-delete __qa_c9_% residual rows directly from the DB before any test.
 *
 * Order (FK-safe): as_team_participation → as_event → as_college.
 * - as_team_participation references as_college(id) and as_event(id).
 * - as_event.code is UNIQUE (no `deleted` in the index) → soft-deleted rows
 *   block re-creation. Same trap as C1/C2/C3/C4/C6/C7.
 * - as_team_participation has no natural-key UNIQUE, so the sweep is for
 *   cleanliness, not correctness — but it lets the happy test assert the
 *   list baseline (no __qa_c9_ rows) holds on every re-run.
 */
function hardCleanupQaTeamParticipation(): void {
  const cmds = [
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_team_participation WHERE college_id IN (SELECT id FROM as_college WHERE name LIKE '__qa_c9_%') OR event_id IN (SELECT id FROM as_event WHERE code LIKE '__QA_C9_%');\"",
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_event WHERE code LIKE '__QA_C9_%' OR name LIKE '__qa_c9_%';\"",
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_college WHERE name LIKE '__qa_c9_%' OR code LIKE '__QA_C9_%';\"",
  ]
  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: 'pipe', timeout: 5000 })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[C9 team-participation] hardCleanup failed (docker / mysql unavailable);',
        'falling back to API cleanup in afterAll.',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

/**
 * Loads the persisted admin storageState and pushes its localStorage entries
 * into the page via an init script. Mirrors the C1 happy3 / C2-C7 workaround
 * (qaTest fixture's storageState option does not reliably inject localStorage
 * on this system).
 */
async function injectStorageState(context: BrowserContext): Promise<string> {
  expect(
    existsSync(STORAGE_STATE_PATH),
    'storageState file must exist (produced by C1 happy1 / _smoke)',
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
 * Ant Design Vue a-select helper: opens the dropdown for the form-item
 * labeled `labelRe` (scoped inside `scope` locator) and clicks the first
 * option whose rendered text matches `optionRe`. The dropdown is teleported
 * to body, so we always pick the LAST visible .ant-select-dropdown portal
 * after the click.
 */
async function selectAntOption(
  scope: Locator,
  page: Page,
  labelRe: RegExp,
  optionRe: RegExp,
): Promise<void> {
  const selectLocator = scope
    .locator('.ant-form-item')
    .filter({ hasText: labelRe })
    .locator('.ant-select-selector')
  await selectLocator.click()
  const dropdown = page.locator('.ant-select-dropdown').last()
  await dropdown.waitFor({ state: 'visible', timeout: 5000 })
  await dropdown
    .locator('.ant-select-item-option')
    .filter({ hasText: optionRe })
    .first()
    .click()
}

/**
 * Creates a unique test college + test team event (type=2, maxParticipants=4,
 * status=1) via the API. Each test calls this with a distinct `tag` so the
 * created rows do not collide across tests or re-runs. Returns the (collegeId,
 * eventId) pair. Caller is responsible for cleanup (handled by afterAll).
 */
async function setupTestCollegeAndTeamEvent(
  token: string,
  tag: string,
): Promise<{ collegeId: number; eventId: number }> {
  const collegeName = `${SUB_PREFIX}college_${tag}`
  const collegeCode = `__QA_C9_${tag.toUpperCase()}`
  const collegeRes = await apiPost<{ id: number }>(
    '/colleges',
    { name: collegeName, code: collegeCode, description: `QA C9 ${tag}` },
    token,
  )
  expect(collegeRes.code, `setup college (${tag}) must succeed`).toBe(200)
  const collegeId = collegeRes.data!.id

  const eventName = `${SUB_PREFIX}team_event_${tag}`
  const eventCode = `__QA_C9_TE_${tag.toUpperCase()}`
  const eventRes = await apiPost<{ id: number }>(
    '/events',
    {
      name: eventName,
      code: eventCode,
      type: 2, // 集体项目 (Docs/04 / EventConstants.TYPE_TEAM)
      category: 1, // 径赛 (4×100米接力 style)
      gender: 1, // 男子
      unit: '秒',
      maxParticipants: 4,
      description: `QA C9 team event ${tag}`,
    },
    token,
  )
  expect(eventRes.code, `setup team event (${tag}) must succeed`).toBe(200)
  const eventId = eventRes.data!.id
  return { collegeId, eventId }
}

test.describe.serial('C9 团体报名模块', () => {
  test.beforeAll(async () => {
    hardCleanupQaTeamParticipation()
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy — UI create + list verify + API GET verify + UI delete
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy: 团体报名 CRUD (列表/新增/详情/取消) — UI + API 双轨', async ({
    page,
    context,
  }) => {
    const token = await injectStorageState(context)
    process.env.QA_TOKEN = token

    // Setup: 1 test college + 1 type=2 team event (maxParticipants=4).
    // Brief deviation: 4 athlete rows are NOT created because the
    // team_participation API explicitly does not track athlete IDs
    // (Docs/08 §48). participantCount=4 represents the 4-member team.
    const { collegeId, eventId } = await setupTestCollegeAndTeamEvent(token, 'happy')
    const collegeName = `${SUB_PREFIX}college_happy`
    const eventName = `${SUB_PREFIX}team_event_happy`

    // Navigate to the team registration page.
    await page.goto('/registration/team')
    await page.waitForLoadState('domcontentloaded')

    // Baseline screenshot. The seed ships zero team_participation rows, so
    // the table may be in its empty state ("暂无数据"). Wait for the table
    // element itself rather than for a row (which would never attach).
    await page.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 10000 })
    await page.screenshot({
      path: evidencePath('happy-01-list-baseline.png'),
      fullPage: true,
    })

    // ── Step 1: open the create modal. ──
    // "新增集体参赛" → "新 增 集 体 参 赛" after Ant CJK auto-spacing.
    await page.getByRole('button', { name: /新\s?增\s?集\s?体\s?参\s?赛/ }).click()
    const modal = page.locator('.ant-modal-body')
    await modal.waitFor({ state: 'visible', timeout: 5000 })

    // ── Step 2: fill the form. ──
    // 学院 a-select (form-item label "学院").
    await selectAntOption(modal, page, /学院/, new RegExp(collegeName))
    // 集体项目 a-select — only type=2 events are listed by the page.
    await selectAntOption(modal, page, /集体项目/, new RegExp(eventName))
    // 参赛人数 a-input-number (form-item label "参赛人数").
    const countInput = modal
      .locator('.ant-form-item')
      .filter({ hasText: /参赛人数/ })
      .locator('input')
    await countInput.fill('4')
    await countInput.press('Tab') // force a-input-number v-model commit

    await page.screenshot({
      path: evidencePath('happy-02-create-form-filled.png'),
      fullPage: true,
    })

    // ── Step 3: submit. Modal OK button "确定" → "确 定". ──
    await page
      .locator('.ant-modal-footer')
      .getByRole('button', { name: /确\s?定/ })
      .click()

    // Ant Design Vue keeps the closed modal in the DOM (display:none) rather
    // than detaching, so wait for the new row directly.
    const newRow = page
      .locator('.ant-table-tbody tr.ant-table-row')
      .filter({ hasText: collegeName })
      .first()
    await expect(newRow, 'new team-participation row must appear').toBeVisible({
      timeout: 10000,
    })

    await page.screenshot({
      path: evidencePath('happy-03-created-in-list.png'),
      fullPage: true,
    })

    // ── Step 4: API track — GET list filtered by collegeId, GET by id. ──
    const listRes = await apiGet<{
      records?: Array<{ id: number; collegeId: number; eventId: number; participantCount: number; status: number }>
    }>(
      `/team-participations?current=1&size=200&collegeId=${collegeId}`,
      token,
    )
    expect(listRes.code, 'GET /api/team-participations must return 200').toBe(200)
    const created = listRes.data?.records?.find(
      (r) => r.eventId === eventId && r.collegeId === collegeId,
    )
    expect(created, 'created team-participation must appear in API list').toBeDefined()
    expect(created!.participantCount, 'participantCount must be 4').toBe(4)
    expect(created!.status, 'status must be 0 (已报名)').toBe(0)
    const createdId = created!.id

    const detail = await apiGet<{ id: number; participantCount: number }>(
      `/team-participations/${createdId}`,
      token,
    )
    expect(detail.code, 'GET /api/team-participations/{id} must return 200').toBe(200)
    expect(detail.data?.participantCount, 'detail participantCount must be 4').toBe(4)

    // ── Step 5: UI delete — click 取消 in the row, then 取消报名 in confirm. ──
    const targetRow = page
      .locator('.ant-table-tbody tr.ant-table-row')
      .filter({ hasText: collegeName })
      .first()
    await targetRow.getByRole('button', { name: /取\s?消/ }).click()

    const confirmDialog = page.locator('.ant-modal-confirm').last()
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })
    // "取消报名" → "取 消 报 名" (the OK button, not the cancel button "取消").
    await confirmDialog
      .getByRole('button', { name: /取\s?消\s?报\s?名/ })
      .click()

    // Wait for the row to disappear (the observable outcome of delete).
    await expect(
      page.locator('.ant-table-tbody tr.ant-table-row', { hasText: collegeName }),
    ).toHaveCount(0, { timeout: 10000 })

    await page.screenshot({
      path: evidencePath('happy-04-deleted-from-list.png'),
      fullPage: true,
    })

    // API track: deleted record must be gone (or filtered as deleted=1).
    const afterDelete = await apiGet(`/team-participations/${createdId}`, token)
    expect(
      [40401, 40412],
      'GET after delete must yield 40412 (TEAM_PARTICIPATION_NOT_FOUND) or 40401 (doc)',
    ).toContain(afterDelete.code)
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — participantCount=0 → @Min(1) violation → 40001.
  // The brief's literal "3 athletes for a 4-person event" path is
  // unreachable: 3 ≤ 4 satisfies @Min(1) and the ≤maxParticipants check, so
  // no validation fires. The only deterministic create-side 40001 path is
  // participantCount=0 (or omitting the field). Logged via appendBug P3.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail1: 参赛人数=0 → 40001 (文档/brief gap: 3-for-4 不可触发)', async ({
    context,
  }) => {
    const token = await injectStorageState(context)
    const { collegeId, eventId } = await setupTestCollegeAndTeamEvent(token, 'f1')

    const res = await apiPost(
      '/team-participations',
      { collegeId, eventId, participantCount: 0 },
      token,
    )
    expect(
      [40001],
      'participantCount=0 must trigger @Min(1) → 40001',
    ).toContain(res.code)

    await writeFileSync(
      evidencePath('fail1-insufficient-count.txt'),
      `fail1 verified at ${new Date().toISOString()}\n` +
        `POST /api/team-participations { collegeId: ${collegeId}, eventId: ${eventId}, participantCount: 0 }\n` +
        `Returned code=${res.code} message=${res.message}.\n` +
        `Brief path "3 athletes for 4-person event" is unreachable: 3 <= 4 satisfies all validations.\n`,
      'utf8',
    )

    appendBug({
      module: 'team-participation',
      caseKey: 'fail1-insufficient-count',
      step:
        'POST /api/team-participations with participantCount=0 (only deterministic 40001 path)',
      expected:
        'Brief asks "register team with only 3 athletes for a 4-person event → 40001". ' +
        'Docs/08 §48 only validates participantCount via @Min(1) and ≤maxParticipants; ' +
        'there is no minParticipants field, so 3-for-4 satisfies every validation and the path is unreachable.',
      actual:
        'Backend accepts participantCount=3 for a maxParticipants=4 event (returns 200). ' +
        'fail1 triggered 40001 via participantCount=0 (@Min(1) violation in ' +
        'TeamParticipationCreateDTO.java:41). This is a brief/docs gap, not a code defect.',
      severity: 'P3',
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — duplicate (collegeId+eventId) → 40934 (COLLEGE_EVENT_DUPLICATE).
  // Docs/08 §48 lists 40901 for "该学院已报名该项目"; the backend actually
  // returns 40934 (ErrorCode.COLLEGE_EVENT_DUPLICATE). Assert both are
  // accepted; appendBug records the doc drift as P2.
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 同学院+同集体项目重复报名 → 40934 (文档标 40901)', async ({
    context,
  }) => {
    const token = await injectStorageState(context)
    const { collegeId, eventId } = await setupTestCollegeAndTeamEvent(token, 'f2')

    // First registration must succeed.
    const first = await apiPost<{ id: number }>(
      '/team-participations',
      { collegeId, eventId, participantCount: 4 },
      token,
    )
    expect(first.code, 'first team-participation create must succeed').toBe(200)
    const firstId = first.data!.id

    // Second registration with same (collegeId, eventId) must be rejected.
    const dup = await apiPost(
      '/team-participations',
      { collegeId, eventId, participantCount: 4 },
      token,
    )
    expect(
      [40901, 40934],
      'duplicate (collegeId+eventId) must yield 40934 (COLLEGE_EVENT_DUPLICATE) or 40901 (doc)',
    ).toContain(dup.code)

    await writeFileSync(
      evidencePath('fail2-duplicate.txt'),
      `fail2 verified at ${new Date().toISOString()}\n` +
        `Created first team-participation id=${firstId} (collegeId=${collegeId}, eventId=${eventId}).\n` +
        `Second POST returned code=${dup.code} message=${dup.message}.\n` +
        `Expected per Docs/08 §48: 40901\n` +
        `Actual backend code: ${dup.code} (ErrorCode.COLLEGE_EVENT_DUPLICATE)\n`,
      'utf8',
    )

    appendBug({
      module: 'team-participation',
      caseKey: 'fail2-duplicate',
      step: 'POST /api/team-participations twice with the same (collegeId, eventId)',
      expected:
        'Docs/08 §48 documents error code 40901 for "该学院已报名该项目（uk_college_event冲突）"',
      actual:
        'Backend returns ErrorCode.COLLEGE_EVENT_DUPLICATE = 40934 ' +
        '(ErrorCode.java:75). 40901 is occupied by USERNAME_EXISTS / password ' +
        'errors (ErrorCode.java:41-43). Documentation drift, not a functional defect.',
      severity: 'P2',
    })

    // Cleanup the first record so afterAll has nothing left to sweep.
    const del = await apiDelete(`/team-participations/${firstId}`, token)
    expect(del.code, 'cleanup delete of first team-participation must succeed').toBe(200)
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — sweep any __qa_c9_* leftovers regardless of test outcome.
  // Order: team-participations (child) → events → colleges (parents).
  // cleanupByPrefix matches record.name ?? record.code; team-participation
  // VOs expose neither, so the contract call is a no-op for that table
  // (mirrors the C1 user sweep). The actual sweep is the beforeAll hard-
  // delete on the next run + the in-test cleanup that fail2 performs.
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    // Contract call (no-op for team_participation since VO has no name/code,
    // but kept for spec compliance and future generalization).
    await cleanupByPrefix(
      '/team-participations?current=1&size=200',
      (r) => r.id as number | string | undefined,
      (id) => `/team-participations/${id}`,
      SUB_PREFIX,
      token,
    )

    // Sweep test events (name starts with SUB_PREFIX, code with __QA_C9_).
    await cleanupByPrefix(
      '/events',
      (r) => r.id as number | string | undefined,
      (id) => `/events/${id}`,
      SUB_PREFIX,
      token,
    )

    // Sweep test colleges (name starts with SUB_PREFIX).
    await cleanupByPrefix(
      '/colleges',
      (r) => r.id as number | string | undefined,
      (id) => `/colleges/${id}`,
      SUB_PREFIX,
      token,
    )

    // Hard-delete sweep as a safety net (handles soft-deleted event/college
    // rows that the API sweep cannot see — same trap as C1/C2/C3/C4/C6/C7).
    hardCleanupQaTeamParticipation()
  })
})
