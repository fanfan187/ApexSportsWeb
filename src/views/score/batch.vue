<template>
  <div class="score-batch-page">
    <!-- Breadcrumb -->
    <a-breadcrumb class="breadcrumb">
      <a-breadcrumb-item>
        <router-link to="/score">成绩管理</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>批量录入</a-breadcrumb-item>
    </a-breadcrumb>

    <!-- Header: 比赛ID 输入 -->
    <div class="page-header">
      <a-space align="center">
        <span class="header-label">比赛场次 ID：</span>
        <a-input-number
          v-model:value="competitionId"
          :min="1"
          placeholder="请输入比赛场次 ID"
          style="width: 200px"
          :disabled="!!routeParamCompetitionId"
        />
        <a-tag v-if="routeParamCompetitionId" color="blue">来自路由参数</a-tag>
      </a-space>
    </div>

    <!-- Tabs: 个人 / 团体 -->
    <a-tabs v-model:activeKey="activeTab" class="batch-tabs">
      <!-- 个人成绩批量录入 -->
      <a-tab-pane key="individual" tab="个人成绩">
        <div class="toolbar">
          <a-space>
            <a-button type="primary" @click="addIndividualRow">+ 添加一行</a-button>
            <a-button
              type="primary"
              :loading="submitLoading"
              :disabled="!canSubmitIndividual"
              @click="handleSubmitIndividual"
            >
              提交批量录入
            </a-button>
            <a-button @click="clearIndividualRows">清空</a-button>
          </a-space>
          <span class="toolbar-tip">共 {{ individualRows.length }} 行</span>
        </div>

        <a-table
          :columns="individualColumns"
          :data-source="individualRows"
          row-key="_key"
          :pagination="false"
          size="small"
          :scroll="{ x: 720 }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">{{ index + 1 }}</template>
            <template v-if="column.key === 'participationId'">
              <a-input-number
                :value="record.participationId"
                :min="1"
                placeholder="参赛记录 ID"
                style="width: 140px"
                @change="(v: number | null) => updateIndividual(index, 'participationId', v ?? 0)"
              />
            </template>
            <template v-if="column.key === 'rank'">
              <a-input-number
                :value="record.rank"
                :min="1"
                placeholder="名次"
                style="width: 90px"
                @change="(v: number | null) => updateIndividual(index, 'rank', v ?? 0)"
              />
            </template>
            <template v-if="column.key === 'scoreValue'">
              <a-input-number
                :value="record.scoreValue"
                :min="0"
                :step="0.01"
                placeholder="成绩数值"
                style="width: 140px"
                @change="(v: number | null) => updateIndividual(index, 'scoreValue', v ?? 0)"
              />
            </template>
            <template v-if="column.key === 'scoreDisplay'">
              <a-input
                :value="record.scoreDisplay"
                placeholder="如 12.34s / 5.67m"
                :maxlength="50"
                style="width: 160px"
                @input="(e: any) => updateIndividual(index, 'scoreDisplay', e?.target?.value ?? '')"
              />
            </template>
            <template v-if="column.key === 'action'">
              <a-button type="link" danger size="small" @click="removeIndividualRow(index)">
                删除
              </a-button>
            </template>
          </template>
          <template #emptyText>
            <a-empty description="暂无录入行，点击「+ 添加一行」开始录入" />
          </template>
        </a-table>
      </a-tab-pane>

      <!-- 团体成绩批量录入 -->
      <a-tab-pane key="team" tab="团体成绩">
        <div class="toolbar">
          <a-space>
            <a-button type="primary" @click="addTeamRow">+ 添加一行</a-button>
            <a-button
              type="primary"
              :loading="submitLoading"
              :disabled="!canSubmitTeam"
              @click="handleSubmitTeam"
            >
              提交批量录入
            </a-button>
            <a-button @click="clearTeamRows">清空</a-button>
          </a-space>
          <span class="toolbar-tip">共 {{ teamRows.length }} 行</span>
        </div>

        <a-table
          :columns="teamColumns"
          :data-source="teamRows"
          row-key="_key"
          :pagination="false"
          size="small"
          :scroll="{ x: 720 }"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">{{ index + 1 }}</template>
            <template v-if="column.key === 'teamParticipationId'">
              <a-input-number
                :value="record.teamParticipationId"
                :min="1"
                placeholder="团体参赛记录 ID"
                style="width: 160px"
                @change="(v: number | null) => updateTeam(index, 'teamParticipationId', v ?? 0)"
              />
            </template>
            <template v-if="column.key === 'rank'">
              <a-input-number
                :value="record.rank"
                :min="1"
                placeholder="名次"
                style="width: 90px"
                @change="(v: number | null) => updateTeam(index, 'rank', v ?? 0)"
              />
            </template>
            <template v-if="column.key === 'scoreValue'">
              <a-input-number
                :value="record.scoreValue"
                :min="0"
                :step="0.01"
                placeholder="成绩数值"
                style="width: 140px"
                @change="(v: number | null) => updateTeam(index, 'scoreValue', v ?? 0)"
              />
            </template>
            <template v-if="column.key === 'scoreDisplay'">
              <a-input
                :value="record.scoreDisplay"
                placeholder="如 12.34s / 5.67m"
                :maxlength="50"
                style="width: 160px"
                @input="(e: any) => updateTeam(index, 'scoreDisplay', e?.target?.value ?? '')"
              />
            </template>
            <template v-if="column.key === 'action'">
              <a-button type="link" danger size="small" @click="removeTeamRow(index)">
                删除
              </a-button>
            </template>
          </template>
          <template #emptyText>
            <a-empty description="暂无录入行，点击「+ 添加一行」开始录入" />
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <!-- 录入结果 Modal -->
    <a-modal
      v-model:open="resultVisible"
      title="录入结果"
      :footer="null"
      width="480px"
      @cancel="resultVisible = false"
    >
      <a-result
        v-if="lastResult"
        :status="lastResult.isRecordBreaking ? 'success' : 'info'"
        :title="`成功录入 ${lastResult.successCount} 条`"
        :sub-title="
          lastResult.isRecordBreaking
            ? '本次录入触发破纪录！'
            : '本次录入未破纪录'
        "
      >
        <template #extra>
          <a-button type="primary" @click="resultVisible = false">知道了</a-button>
        </template>
      </a-result>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import { batchAddScores, batchAddTeamScores } from '@/api/score'
import type {
  BatchScoreDTO,
  BatchTeamScoreDTO,
  ScoreEntryResultVO,
} from '@/views/score/types'

// ===== Route =====
const route = useRoute()

/** 路由参数注入的 competitionId（路径 :id 或 query.competitionId）。未注入则为 null，由顶部输入兜底 */
const routeParamCompetitionId = computed<number | null>(() => {
  const fromParam = route.params.competitionId ?? route.params.id
  if (fromParam !== undefined) {
    const n = Number(Array.isArray(fromParam) ? fromParam[0] : fromParam)
    if (Number.isFinite(n) && n > 0) return n
  }
  const fromQuery = route.query.competitionId
  if (fromQuery !== undefined) {
    const n = Number(fromQuery)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
})

/** 比赛 ID（路由参数优先，否则手动输入） */
const competitionId = ref<number | null>(routeParamCompetitionId.value)

// ===== Tab state =====
const activeTab = ref<'individual' | 'team'>('individual')

// ===== 行 ID 生成器 =====
let rowKeySeed = 0
function nextKey(): number {
  rowKeySeed += 1
  return rowKeySeed
}

// ===== 个人成绩行 =====
interface IndividualRow {
  _key: number
  participationId: number
  rank: number
  scoreValue: number
  scoreDisplay: string
}

const individualRows = reactive<IndividualRow[]>([])

const individualColumns: TableColumnsType = [
  { title: '#', key: 'index', width: 50, fixed: 'left' },
  { title: '参赛记录 ID', key: 'participationId', width: 170 },
  { title: '名次', key: 'rank', width: 110 },
  { title: '成绩数值', key: 'scoreValue', width: 170 },
  { title: '成绩展示', key: 'scoreDisplay', width: 190 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' },
]

function addIndividualRow() {
  individualRows.push({
    _key: nextKey(),
    participationId: 0,
    rank: 1,
    scoreValue: 0,
    scoreDisplay: '',
  })
}

function removeIndividualRow(index: number) {
  individualRows.splice(index, 1)
}

function clearIndividualRows() {
  individualRows.splice(0, individualRows.length)
}

function updateIndividual<K extends keyof IndividualRow>(
  index: number,
  field: K,
  value: IndividualRow[K],
) {
  if (index >= 0 && index < individualRows.length) {
    individualRows[index][field] = value
  }
}

const canSubmitIndividual = computed(() => {
  return (
    !!competitionId.value &&
    individualRows.length > 0 &&
    individualRows.every(
      (r) =>
        r.participationId > 0 &&
        r.rank > 0 &&
        r.scoreValue > 0 &&
        r.scoreDisplay.trim() !== '',
    )
  )
})

// ===== 团体成绩行 =====
interface TeamRow {
  _key: number
  teamParticipationId: number
  rank: number
  scoreValue: number
  scoreDisplay: string
}

const teamRows = reactive<TeamRow[]>([])

const teamColumns: TableColumnsType = [
  { title: '#', key: 'index', width: 50, fixed: 'left' },
  { title: '团体参赛记录 ID', key: 'teamParticipationId', width: 190 },
  { title: '名次', key: 'rank', width: 110 },
  { title: '成绩数值', key: 'scoreValue', width: 170 },
  { title: '成绩展示', key: 'scoreDisplay', width: 190 },
  { title: '操作', key: 'action', width: 80, fixed: 'right' },
]

function addTeamRow() {
  teamRows.push({
    _key: nextKey(),
    teamParticipationId: 0,
    rank: 1,
    scoreValue: 0,
    scoreDisplay: '',
  })
}

function removeTeamRow(index: number) {
  teamRows.splice(index, 1)
}

function clearTeamRows() {
  teamRows.splice(0, teamRows.length)
}

function updateTeam<K extends keyof TeamRow>(
  index: number,
  field: K,
  value: TeamRow[K],
) {
  if (index >= 0 && index < teamRows.length) {
    teamRows[index][field] = value
  }
}

const canSubmitTeam = computed(() => {
  return (
    !!competitionId.value &&
    teamRows.length > 0 &&
    teamRows.every(
      (r) =>
        r.teamParticipationId > 0 &&
        r.rank > 0 &&
        r.scoreValue > 0 &&
        r.scoreDisplay.trim() !== '',
    )
  )
})

// ===== 提交 =====
const submitLoading = ref(false)
const resultVisible = ref(false)
const lastResult = ref<ScoreEntryResultVO | null>(null)

function ensureCompetitionId(): number {
  const id = competitionId.value
  if (!id || id <= 0) {
    message.warning('请填写比赛场次 ID')
    throw new Error('missing competitionId')
  }
  return id
}

async function handleSubmitIndividual() {
  const id = ensureCompetitionId()
  if (!canSubmitIndividual.value) {
    message.warning('请完整填写所有行的参赛记录 ID / 名次 / 成绩数值 / 成绩展示')
    return
  }
  const dto: BatchScoreDTO = {
    competitionId: id,
    items: individualRows.map((r) => ({
      participationId: r.participationId,
      rank: r.rank,
      scoreValue: r.scoreValue,
      scoreDisplay: r.scoreDisplay,
    })),
  }
  submitLoading.value = true
  try {
    const result = await batchAddScores(dto)
    lastResult.value = result
    resultVisible.value = true
    // 提交成功后清空已录入行
    clearIndividualRows()
  } finally {
    submitLoading.value = false
  }
}

async function handleSubmitTeam() {
  const id = ensureCompetitionId()
  if (!canSubmitTeam.value) {
    message.warning('请完整填写所有行的团体参赛记录 ID / 名次 / 成绩数值 / 成绩展示')
    return
  }
  const dto: BatchTeamScoreDTO = {
    competitionId: id,
    items: teamRows.map((r) => ({
      teamParticipationId: r.teamParticipationId,
      rank: r.rank,
      scoreValue: r.scoreValue,
      scoreDisplay: r.scoreDisplay,
    })),
  }
  submitLoading.value = true
  try {
    const result = await batchAddTeamScores(dto)
    lastResult.value = result
    resultVisible.value = true
    clearTeamRows()
  } finally {
    submitLoading.value = false
  }
}
</script>

<style scoped lang="less">
.score-batch-page {
  .breadcrumb {
    margin-bottom: @space-md;
  }

  .page-header {
    margin-bottom: @space-md;

    .header-label {
      color: @text-secondary;
    }
  }

  .batch-tabs {
    :deep(.ant-tabs-content) {
      padding-top: @space-md;
    }
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: @space-sm;
    margin-bottom: @space-md;

    .toolbar-tip {
      margin-left: @space-sm;
      color: @text-secondary;
      font-size: @font-size-sm;
    }
  }
}
</style>
