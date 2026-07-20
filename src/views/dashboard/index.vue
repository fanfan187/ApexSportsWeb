<template>
  <div class="dashboard-page">
    <!-- 页面头 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">首页概览</h2>
        <span class="page-subtitle">{{ todayStr }}</span>
      </div>
      <a-button type="primary" :loading="refreshing" @click="loadAll">
        刷新
      </a-button>
    </div>

    <!-- KPI 卡片区 -->
    <a-row :gutter="16" class="kpi-row">
      <a-col v-for="kpi in kpiList" :key="kpi.key" :span="6">
        <a-card size="small" class="kpi-card">
          <a-statistic :title="kpi.title" :value="kpi.value" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 赛程进度 -->
    <a-card size="small" class="progress-card" :loading="loadingOverview">
      <template #title>赛程进度</template>
      <a-progress
        v-if="overview"
        :percent="schedulePercent"
        status="active"
      />
      <div v-if="overview" class="progress-meta">
        <span>已完成 {{ overview.completedCompetitions }} 场</span>
        <a-divider type="vertical" />
        <span>总计 {{ overview.totalCompetitions }} 场</span>
        <a-divider type="vertical" />
        <span class="progress-text">{{ overview.scheduleProgress }}</span>
      </div>
      <a-empty
        v-else
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
        description="暂无进度数据"
      />
    </a-card>

    <!-- 今日赛程 -->
    <a-card size="small" class="section-card">
      <template #title>
        今日赛程
        <span v-if="todaySchedule" class="section-count">
          共 {{ todaySchedule.totalCompetitions }} 场
        </span>
      </template>
      <a-table
        :columns="scheduleColumns"
        :data-source="todaySchedule?.competitions ?? []"
        :loading="loadingToday"
        row-key="competitionId"
        :pagination="false"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag
              :color="
                COMPETITION_STATUS_COLOR[(record as TodayScheduleItem).status] ?? 'default'
              "
            >
              {{
                COMPETITION_STATUS_MAP[(record as TodayScheduleItem).status] ?? '未知'
              }}
            </a-tag>
          </template>
          <template v-if="column.key === 'chiefRefereeName'">
            {{ (record as TodayScheduleItem).chiefRefereeName ?? '—' }}
          </template>
          <template v-if="column.key === 'endTime'">
            {{ (record as TodayScheduleItem).endTime ?? '—' }}
          </template>
        </template>
        <template #emptyText>
          <a-empty
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="今日暂无赛程"
          />
        </template>
      </a-table>
    </a-card>

    <!-- 破纪录汇总 -->
    <a-card size="small" class="section-card">
      <template #title>
        破纪录汇总
        <span v-if="breakingRecords" class="section-count">
          共 {{ breakingRecords.totalCount }} 项
        </span>
      </template>
      <a-table
        :columns="recordColumns"
        :data-source="breakingRecords?.records ?? []"
        :loading="loadingRecords"
        row-key="id"
        :pagination="false"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'athleteName'">
            {{ (record as BreakingRecordItem).athleteName ?? '—（团体项目）' }}
          </template>
          <template v-if="column.key === 'oldScoreDisplay'">
            {{ (record as BreakingRecordItem).oldScoreDisplay ?? '首次设立' }}
          </template>
          <template v-if="column.key === 'recordType'">
            <a-tag
              :color="
                RECORD_TYPE_TAG[(record as BreakingRecordItem).recordType] ?? 'default'
              "
            >
              {{ (record as BreakingRecordItem).recordType }}
            </a-tag>
          </template>
        </template>
        <template #emptyText>
          <a-empty
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="本届暂无破纪录"
          />
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Empty, message, type TableColumnsType } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  getDashboardOverview,
  getTodaySchedule,
  getBreakingRecords,
} from '@/api/dashboard'
import type {
  OverviewVO,
  TodayScheduleVO,
  TodayScheduleItem,
  BreakingRecordsVO,
  BreakingRecordItem,
} from '@/views/dashboard/types'
import {
  COMPETITION_STATUS_MAP,
  COMPETITION_STATUS_COLOR,
  RECORD_TYPE_TAG,
} from '@/views/dashboard/constants'

// ===== 数据状态 =====
const overview = ref<OverviewVO | null>(null)
const todaySchedule = ref<TodayScheduleVO | null>(null)
const breakingRecords = ref<BreakingRecordsVO | null>(null)

// ===== 加载状态 =====
const loadingOverview = ref(false)
const loadingToday = ref(false)
const loadingRecords = ref(false)
const refreshing = ref(false)

// ===== KPI 卡片列表 =====
interface KpiItem {
  key: string
  title: string
  value: number
}

const kpiList = computed<KpiItem[]>(() => {
  if (!overview.value) return []
  const o = overview.value
  return [
    { key: 'athletes', title: '运动员总数', value: o.totalAthletes },
    { key: 'colleges', title: '参赛学院', value: o.totalColleges },
    { key: 'events', title: '比赛项目', value: o.totalEvents },
    { key: 'registrations', title: '报名人次', value: o.totalRegistrations },
    { key: 'today', title: '今日场次', value: o.todayCompetitions },
    { key: 'records', title: '破纪录数', value: o.recordBreakCount },
  ]
})

// ===== 赛程进度解析 =====
const schedulePercent = computed<number>(() => {
  if (!overview.value?.scheduleProgress) return 0
  const raw = overview.value.scheduleProgress.replace('%', '')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
})

// ===== 今日日期标题 =====
const todayStr = computed(() => dayjs().format('YYYY-MM-DD'))

// ===== 表格列定义 =====
const scheduleColumns: TableColumnsType = [
  { title: '项目名称', dataIndex: 'eventName', key: 'eventName', width: 220 },
  { title: '场地', dataIndex: 'venueName', key: 'venueName', width: 120 },
  { title: '开始', dataIndex: 'startTime', key: 'startTime', width: 80 },
  { title: '结束', dataIndex: 'endTime', key: 'endTime', width: 80 },
  { title: '参赛', dataIndex: 'participantCount', key: 'participantCount', width: 70 },
  { title: '主裁判', key: 'chiefRefereeName', width: 110 },
  { title: '组别', dataIndex: 'groupNumber', key: 'groupNumber', width: 70 },
  { title: '状态', key: 'status', width: 90 },
]

const recordColumns: TableColumnsType = [
  { title: '项目', dataIndex: 'eventName', key: 'eventName', width: 200 },
  { title: '运动员/单位', key: 'athleteName', width: 140 },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName', width: 140 },
  { title: '新纪录', dataIndex: 'newScoreDisplay', key: 'newScoreDisplay', width: 110 },
  { title: '原纪录', key: 'oldScoreDisplay', width: 110 },
  { title: '类型', key: 'recordType', width: 100 },
  { title: '日期', dataIndex: 'breakDate', key: 'breakDate', width: 120 },
]

// ===== 数据加载 =====
async function loadOverview() {
  loadingOverview.value = true
  try {
    overview.value = await getDashboardOverview()
  } catch {
    // 拦截器已统一 toast，此处仅终止 loading
  } finally {
    loadingOverview.value = false
  }
}

async function loadToday() {
  loadingToday.value = true
  try {
    todaySchedule.value = await getTodaySchedule()
  } catch {
    // 拦截器已统一 toast
  } finally {
    loadingToday.value = false
  }
}

async function loadRecords() {
  loadingRecords.value = true
  try {
    breakingRecords.value = await getBreakingRecords()
  } catch {
    // 拦截器已统一 toast
  } finally {
    loadingRecords.value = false
  }
}

async function loadAll() {
  refreshing.value = true
  try {
    await Promise.all([loadOverview(), loadToday(), loadRecords()])
    message.success('刷新成功')
  } catch {
    // 单个 load 已处理错误，理论不会到这；兜底防御
  } finally {
    refreshing.value = false
  }
}

onMounted(loadAll)

// 可选：每 60 秒自动刷新（默认关闭，避免无谓请求）
// setInterval(loadAll, 60000)
</script>

<style scoped lang="less">
.dashboard-page {
  background: @bg-card;
  border-radius: @border-radius-lg;
  padding: @space-lg;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: @space-md;

    .header-left {
      display: flex;
      align-items: baseline;
      gap: @space-sm;

      .page-title {
        margin: 0;
        font-size: @font-size-h1;
        font-weight: 600;
        color: @text-color;
      }

      .page-subtitle {
        font-size: @font-size-sm;
        color: @text-secondary;
      }
    }
  }

  .kpi-row {
    margin-bottom: @space-md;

    .kpi-card {
      margin-bottom: @space-md;

      .kpi-prefix {
        margin-right: @space-xs;
      }
    }
  }

  .progress-card {
    margin-bottom: @space-md;

    .progress-meta {
      margin-top: @space-sm;
      font-size: @font-size-base;
      color: @text-secondary;

      .progress-text {
        color: @primary-color;
        font-weight: 600;
      }
    }
  }

  .section-card {
    margin-bottom: @space-md;

    .section-count {
      margin-left: @space-sm;
      font-size: @font-size-sm;
      color: @text-secondary;
      font-weight: 400;
    }
  }
}
</style>
