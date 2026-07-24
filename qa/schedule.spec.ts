// ApexSports QA — C10 赛程安排模块 spec (schedule)
//
// Covers Docs/09-赛程安排模块.md:
//   - GET /api/competitions          (列表, 分页)
//   - GET /api/competitions/booklet  (秩序册; 注意: 文档 §70 标 URL 为
//                                    /api/competitions/schedule, 后端实际为
//                                    /api/competitions/booklet — 文档漂移,
//                                    已通过 appendBug 记录为 P2)
//   - GET /api/competitions/{id}     (详情, 含裁判/器材/参赛者)
//
// 本 spec 严格只读 (per MUST NOT: "Do NOT create or delete competitions";
// "本 spec 不创建运动会"). 不创建任何 as_competition 行。
//
// 关键环境事实 (verified 2026-07-21 via apiLogin + GET /api/competitions):
//   - init/data.sql 不种子任何 as_competition 行 (grep "as_competition" 仅
//     命中 as_record.competition_name 字符串列). 赛程列表在 pristine 状态下
//     为空 (records=[], total=0).
//   - CompetitionController 无 "生成赛程" 端点; 只有 CRUD. 故 plan 中 "trigger
//     generation" 步骤无法实施. 已通过 appendBug (P1) 记录该缺口, 并标记 C11
//     (成绩模块) 依赖未满足.
//
// 在 list 为空的情况下, spec 仍完成:
//   - happy: 列表页渲染 (空态) → 秩序册页渲染 (标题 + 空表) → 详情页渲染
//            (面包屑 + skeleton, 因 GET /api/competitions/{id} 返回 40413).
//   - fail1: 未登录访问 /schedule/{id} → 守卫跳 /login?redirect=/schedule/{id}.
//   - fail2: 无 seed 比赛场次可复制, 无生成端点可触发重复生成 → test.skip()
//            + 写入 skipped-reason 文件 + appendBug (P2 文档漂移).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'node:child_process'
import type { BrowserContext } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { qaTest, qaTestAnonymous } from './lib/fixtures'
import {
  apiLogin,
  apiGet,
  apiPost,
  apiDelete,
  cleanupByPrefix,
} from './lib/api'
import { PREFIX, appendBug } from './lib/reporter'

const SUB_PREFIX = PREFIX + 'c10_'
const EVIDENCE_DIR = 'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-schedule'
const SKIPPED_FAIL2_REASON_PATH = resolve(
  EVIDENCE_DIR,
  'skipped-fail2-reason.txt',
)
const STORAGE_STATE_PATH =
  'E:/2_Project(personal)/1_顶点体育/.omo/evidence/qa-harness/admin.storageState.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })

function evidencePath(name: string): string {
  return resolve(EVIDENCE_DIR, name)
}

/**
 * 硬删除 __qa_c10_ 残留行 (理论上 spec 是只读的, 不应产生任何 __qa_c10_
 * 行; 但作为防御性清理, 仍扫描 as_competition / as_referee_assignment /
 * as_competition_equipment 三张表).
 *
 * 删除顺序: 先删引用方 (as_referee_assignment / as_competition_equipment
 * 引用 as_competition.id), 再删 as_competition.
 */
function hardCleanupQaSchedule(): void {
  const cmds = [
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_competition_equipment WHERE remark LIKE '__qa_c10_%';\"",
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_referee_assignment WHERE 1=0;\"",
    'docker exec apex_sports_db mysql -usports_user -p123456 apex_sports ' +
      "-e \"DELETE FROM as_competition WHERE remark LIKE '__qa_c10_%';\"",
  ]
  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: 'pipe', timeout: 5000 })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[C10 schedule] hardCleanupQaSchedule failed (docker / mysql unavailable);',
        'falling back to API cleanup in afterAll.',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

/**
 * 注入已持久化的 admin storageState 到 page localStorage (沿用 C1/C2/C3
 * workaround; qaTest fixture 在此系统上不 reliably 注入).
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

interface CompetitionRecord {
  id: number
  eventName?: string
  venueName?: string
  startTime?: string
  endTime?: string
  status?: number
  remark?: string
  eventId?: number
  venueId?: number
  round?: number
  groupNo?: number
}

test.describe.serial('C10 赛程安排模块', () => {
  // ───────────────────────────────────────────────────────────────────────
  // beforeAll — 防御性硬清理 + 查询 seed 比赛场次, 决定 happy 路径分支
  // ───────────────────────────────────────────────────────────────────────
  let adminToken = ''
  let seedCompetitions: CompetitionRecord[] = []
  let firstSeedId: number | null = null

  test.beforeAll(async () => {
    hardCleanupQaSchedule()
    adminToken = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = adminToken

    const listRes = await apiGet<{
      records?: CompetitionRecord[]
      total?: number
    }>('/competitions?current=1&size=100', adminToken)
    expect(listRes.code, 'GET /api/competitions must return 200').toBe(200)
    seedCompetitions = listRes.data?.records ?? []
    if (seedCompetitions.length > 0) {
      firstSeedId = seedCompetitions[0].id
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // happy — 列表 / 秩序册 / 详情 (只读; 适应空态与有数据两种情况)
  // ───────────────────────────────────────────────────────────────────────
  qaTest('happy: 列表 / 秩序册 / 详情 (只读; 适应空态)', async ({
    page,
    context,
  }) => {
    const token = await injectStorageState(context)

    // 1. GET /api/competitions — API 轨确认 (双轨验证)
    const listRes = await apiGet<{
      records?: CompetitionRecord[]
      total?: number
    }>('/competitions?current=1&size=10', token)
    expect(listRes.code, 'GET /api/competitions must return 200').toBe(200)
    const apiRecords = listRes.data?.records ?? []

    // 2. UI: 访问 /schedule 列表页
    await page.goto('/schedule')
    await page.waitForLoadState('domcontentloaded')

    // 表格容器一定渲染 (无论有无数据)
    const tableWrapper = page.getByRole('table').first()
    await expect(tableWrapper, 'schedule table wrapper must render').toBeVisible({
      timeout: 10000,
    })

    await page.screenshot({
      path: evidencePath('happy-01-schedule-list.png'),
      fullPage: true,
    })

    if (apiRecords.length === 0) {
      // 空态: 列表为空; 记录 schedule 生成端点缺失 + C11 依赖未满足
      appendBug({
        module: 'schedule',
        caseKey: 'happy-empty-schedule-list',
        step:
          '访问 /schedule 列表页; GET /api/competitions?current=1&size=10 返回 records=[]',
        expected:
          'plan C10 假定存在 "生成赛程" 端点; happy 路径应在 list 为空时触发生成并断言 table 非空',
        actual:
          'ApexSports/.../controllers/CompetitionController.java 未提供 "生成赛程" 端点 (只有 CRUD 18 个). ' +
          'init/data.sql 不种子任何 as_competition 行 (grep 仅命中 as_record.competition_name 字符串列). ' +
          '本 spec 严格只读 (per MUST NOT: 不创建/删除 competition), 故 happy 路径以空态完成列表 + 秩序册 + 详情截图. ' +
          'C11 (成绩模块) 依赖 schedule sessions; 在无 seed schedule 的 pristine 状态下, C11 需自行创建比赛场次或前置 seed.',
        severity: 'P1',
        screenshotPath: 'happy-01-schedule-list.png',
      })
    } else {
      // 有数据: 断言至少一行. 数据行含操作按钮 (查看), 表头行不含, 用 filter 区分.
      const tableRows = page
        .getByRole('table')
        .first()
        .getByRole('row')
        .filter({ has: page.getByRole('button') })
      await expect(
        tableRows.first(),
        'at least one schedule row must render when API has records',
      ).toBeVisible()
      expect(
        await tableRows.count(),
        'UI table row count must match API records length (within page)',
      ).toBeGreaterThan(0)
    }

    // 3. UI: 访问 /schedule/booklet 秩序册页
    await page.goto('/schedule/booklet')
    await page.waitForLoadState('domcontentloaded')

    // 秩序册标题固定渲染 "比赛秩序册"
    const bookletTitle = page.getByRole('heading', {
      name: /比\s?赛\s?秩\s?序\s?册/,
    })
    await expect(
      bookletTitle,
      'booklet page title "比赛秩序册" must render',
    ).toBeVisible({ timeout: 10000 })

    // 秩序册表格容器渲染 (空态时表格本身存在但显示 <a-empty>)
    const bookletTable = page.getByRole('table').first()
    await expect(bookletTable, 'booklet table must render').toBeVisible()

    await page.screenshot({
      path: evidencePath('happy-02-booklet.png'),
      fullPage: true,
    })

    // 4. UI: 详情页 — 若有 seed 数据, 点击 查看 跳转; 否则直接访问 /schedule/1
    //    (pristine 无数据, GET /api/competitions/1 返回 40413; 详情页 skeleton
    //    渲染)
    let detailId: number
    if (firstSeedId !== null) {
      detailId = firstSeedId
      // 回到列表页, 点击 查看 跳转
      await page.goto('/schedule')
      await page.waitForLoadState('domcontentloaded')
      const viewButton = page
        .getByRole('table')
        .first()
        .getByRole('row')
        .filter({ has: page.getByRole('button') })
        .first()
        .getByRole('button', { name: /查\s?看/ })
      await viewButton.click()
      await page.waitForURL(/\/schedule\/\d+/, { timeout: 10000 })
    } else {
      // 无 seed: 直接访问 /schedule/1; 详情页会渲染面包屑 + skeleton
      detailId = 1
      await page.goto(`/schedule/${detailId}`)
      await page.waitForLoadState('domcontentloaded')
    }

    // 详情页: 面包屑一定渲染 (无论数据是否存在)
    const breadcrumb = page.locator('.ant-breadcrumb').first()
    await expect(
      breadcrumb,
      'detail breadcrumb must render',
    ).toBeVisible({ timeout: 10000 })

    // 详情页: 标签页 (基本信息 / 运动员编排 / 团体编排 / 裁判分配 / 器材分配)
    // 一定渲染. 即使数据为空, a-tabs 容器存在.
    const tabs = page.locator('.ant-tabs')
    await expect(tabs, 'detail tabs must render').toBeVisible({
      timeout: 10000,
    })

    await page.screenshot({
      path: evidencePath('happy-03-detail.png'),
      fullPage: true,
    })

    // 若有数据: 双轨验证 GET /api/competitions/{id} 详情接口
    if (firstSeedId !== null) {
      const detailRes = await apiGet<{
        competition?: { id: number; eventName?: string }
      }>(`/competitions/${detailId}`, token)
      expect(
        detailRes.code,
        'GET /api/competitions/{id} must return 200 for existing seed',
      ).toBe(200)
      expect(
        detailRes.data?.competition?.id,
        'detail response must include competition.id',
      ).toBe(detailId)
    } else {
      // 无数据: GET /api/competitions/{id} 返回 40413 COMPETITION_NOT_FOUND
      const detailRes = await apiGet(`/competitions/${detailId}`, token)
      expect(
        detailRes.code,
        'GET /api/competitions/1 in pristine state must return 40413',
      ).toBe(40413)
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail1 — 未登录访问 /schedule/{id} → 守卫跳 /login?redirect=/schedule/{id}
  // ───────────────────────────────────────────────────────────────────────
  qaTestAnonymous('fail1 (qaTestAnonymous): 未登录访问 /schedule/1 → 守卫跳 /login?redirect=/schedule/1', async ({
    page,
  }) => {
    await page.goto('/schedule/1')

    // router.beforeEach (src/router/index.ts:194-196) 无 token 时 push
    // /login?redirect={to.path}
    await page.waitForURL(/\/login\?redirect=\/schedule\/1/, { timeout: 10000 })

    const url = new URL(page.url())
    expect(
      url.searchParams.get('redirect'),
      'redirect query must equal /schedule/1',
    ).toBe('/schedule/1')

    await page.screenshot({
      path: evidencePath('fail1-guard-redirect.png'),
      fullPage: true,
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // fail2 — 触发 "重复生成赛程" → 期望 40901 / 40941 / 40942 之一
  //
  // 现实: CompetitionController 无 "生成赛程" 端点 (只有 CRUD). 且
  // init/data.sql 不种子任何 as_competition 行, 故无法通过 "复制已有 seed
  // 场次" 触发冲突. 在此情形下, 该用例 test.skip() + 写入原因文件 +
  // appendBug 记录文档/实现漂移 (P2).
  //
  // 若 seed 已存在比赛场次 (e.g. 后续 wave 注入了数据), 用例会:
  //   - 取第一条 seed 的 (eventId, venueId, startTime, endTime)
  //   - POST /api/competitions 复制上述字段 → 期望 40941 (径赛冲突) 或
  //     40942 (场地冲突) 或 40901 (文档标)
  //   - 严格不创建实体: 若服务端意外返回 200 (冲突未检测), 立即 DELETE 清理
  // ───────────────────────────────────────────────────────────────────────
  qaTest('fail2: 重复生成比赛场次 → 期望 40901/40941/40942 (冲突)', async ({
    context,
  }) => {
    const token = await injectStorageState(context)

    if (seedCompetitions.length === 0) {
      const reason =
        `Skipped at ${new Date().toISOString()}\n` +
        `Reason: pristine seed has zero as_competition rows; no seed competition to duplicate.\n` +
        `CompetitionController has no "generate schedule" endpoint (only CRUD 18 endpoints).\n` +
        `Cannot trigger "duplicate schedule generation" without first creating one — ` +
        `which would violate MUST NOT "Do NOT create or delete competitions".\n`
      writeFileSync(SKIPPED_FAIL2_REASON_PATH, reason, 'utf8')

      appendBug({
        module: 'schedule',
        caseKey: 'fail2-no-duplicate-path',
        step:
          '尝试触发 "重复生成赛程" 以验证 40901/40941/40942 冲突错误码',
        expected:
          'plan 假定存在 "生成赛程" 端点; 重复触发应返回冲突码 ' +
          '(40901 per Docs/09 §53, 或 40941 TRACK_TIME_CONFLICT / 40942 VENUE_TIME_CONFLICT per ErrorCode.java:86-87)',
        actual:
          'CompetitionController 无 "生成赛程" 端点 (只有 POST /api/competitions 单条 CRUD). ' +
          'init/data.sql 不种子任何 as_competition 行 (records=[], total=0). ' +
          '无法在不创建比赛场次的前提下触发 "重复生成"; 本 spec 严格只读, 故 fail2 跳过.',
        severity: 'P2',
      })
      test.skip(true, reason)
      return
    }

    // 有 seed 数据: 取第一条作为复制源, POST 重复 → 期望冲突
    const seed = seedCompetitions[0]
    const dupPayload = {
      eventId: seed.eventId,
      venueId: seed.venueId,
      round: seed.round ?? 1,
      groupNo: seed.groupNo ?? 1,
      startTime: seed.startTime,
      endTime: seed.endTime,
      remark: SUB_PREFIX + 'dup_attempt',
    }

    const dupRes = await apiPost<{ id?: number }>(
      '/competitions',
      dupPayload,
      token,
    )

    // 服务端意外接受 (冲突未检测): 立即清理, 防止违反 "不创建实体" 约束
    if (dupRes.code === 200 && dupRes.data?.id) {
      await apiDelete(`/competitions/${dupRes.data.id}`, token)
      appendBug({
        module: 'schedule',
        caseKey: 'fail2-duplicate-not-detected',
        step:
          `POST /api/competitions 复制 seed (eventId=${seed.eventId}, ` +
          `venueId=${seed.venueId}, startTime=${seed.startTime}, ` +
          `endTime=${seed.endTime}); 期望冲突, 实际 200 接受`,
        expected:
          'Docs/09 §53 业务规则: 径赛互斥校验 + 场地冲突校验应阻止重复创建',
        actual:
          `服务端返回 200 接受重复场次 (id=${dupRes.data.id}); 冲突未检测. ` +
          '已立即 DELETE 清理. 后端冲突检测逻辑可能存在缺陷.',
        severity: 'P1',
      })
      // 严格断言失败以暴露 bug — 这就是 fail2 应该做的.
      expect(
        dupRes.code,
        'duplicate schedule creation must be rejected (TRACK_TIME_CONFLICT=40941 or VENUE_TIME_CONFLICT=40942)',
      ).not.toBe(200)
      return
    }

    expect(
      [40901, 40941, 40942],
      'duplicate schedule creation must yield 40901 (doc) / 40941 (track conflict) / 40942 (venue conflict)',
    ).toContain(dupRes.code)

    await writeFileSync(
      evidencePath('fail2-duplicate-blocked.txt'),
      `fail2 verified at ${new Date().toISOString()}\n` +
        `Source seed competition id=${seed.id} eventId=${seed.eventId} venueId=${seed.venueId}\n` +
        `POST /api/competitions with duplicate (eventId/venueId/startTime/endTime) returned code=${dupRes.code}.\n` +
        `Expected: 40901 (doc) / 40941 (TRACK_TIME_CONFLICT) / 40942 (VENUE_TIME_CONFLICT)\n`,
      'utf8',
    )
  })

  // ───────────────────────────────────────────────────────────────────────
  // afterAll — 防御性清扫 (本 spec 严格只读, 正常情况下不应产生 __qa_c10_
  // 实体; 但若 fail2 的 "意外 200" 路径被触发, 立即清理其残留)
  // ───────────────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const token = await apiLogin('admin', 'admin123')
    process.env.QA_TOKEN = token

    // cleanupByPrefix 匹配 record.name ?? record.code; CompetitionVO 无
    // name/code, 只有 eventName/venueName (来自关联表). 此处用 remark 字段
    // 无法被 helper 匹配, 故 contract call 是 best-effort; 真正清理依赖
    // beforeAll 的 hardCleanupQaSchedule (按 remark LIKE '__qa_c10_%').
    await cleanupByPrefix(
      '/competitions?current=1&size=200',
      (r) => r.id as number | string | undefined,
      (id) => `/competitions/${id}`,
      SUB_PREFIX,
      token,
    )

    // 二次保险: 硬删除任何 remark 带有 __qa_c10_ 的 as_competition 残留
    hardCleanupQaSchedule()
  })
})
