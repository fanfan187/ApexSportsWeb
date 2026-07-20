<template>
  <div class="ranking-detail-page">
    <!-- Breadcrumb -->
    <div class="breadcrumb-row">
      <a-breadcrumb class="breadcrumb">
        <a-breadcrumb-item>
          <router-link to="/ranking">学院积分排名</router-link>
        </a-breadcrumb-item>
        <a-breadcrumb-item>学院积分详情</a-breadcrumb-item>
      </a-breadcrumb>
      <a-button @click="handleBack">返回</a-button>
    </div>

    <a-spin :spinning="loading">
      <!-- Header: 学院概览 -->
      <div v-if="data" class="page-header">
        <h2 class="title">{{ data.collegeName }}</h2>
        <a-descriptions :column="3" size="small" class="meta-desc">
          <a-descriptions-item label="学院代码">
            {{ data.collegeCode }}
          </a-descriptions-item>
          <a-descriptions-item label="总排名">
            <a-tag v-if="data.ranking !== null" color="blue">第 {{ data.ranking }} 名</a-tag>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="总积分">
            <span class="total-points">{{ data.totalPoints }}</span>
          </a-descriptions-item>
        </a-descriptions>
      </div>

      <!-- 奖牌统计 -->
      <div v-if="data" class="medal-stats">
        <a-card size="small" title="奖牌统计" class="medal-card">
          <a-space size="large">
            <div v-for="medal in medalDisplayList" :key="medal.key" class="medal-item">
              <a-tag :color="medal.color" class="medal-tag">{{ medal.label }}</a-tag>
              <span class="medal-count">{{ medal.count }}</span>
            </div>
            <a-divider type="vertical" />
            <div class="meta-stat">
              <span class="meta-label">个人积分</span>
              <span class="meta-value">{{ data.individualPoints }}</span>
            </div>
            <div class="meta-stat">
              <span class="meta-label">团体积分</span>
              <span class="meta-value">{{ data.teamPoints }}</span>
            </div>
          </a-space>
        </a-card>
      </div>

      <!-- 明细表 -->
      <a-table
        v-if="data"
        :columns="columns"
        :data-source="eventDetails"
        :loading="loading"
        row-key="eventId"
        :pagination="false"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <!-- 类型列 -->
          <template v-if="column.key === 'eventType'">
            <a-tag :color="EVENT_TYPE_COLOR[(record as EventScoreDetailVO).eventType] ?? 'default'">
              {{ EVENT_TYPE_LABEL[(record as EventScoreDetailVO).eventType] ?? (record as EventScoreDetailVO).eventType }}
            </a-tag>
          </template>
          <!-- 运动员列 -->
          <template v-if="column.key === 'athleteName'">
            {{ (record as EventScoreDetailVO).athleteName ?? '（团体）' }}
          </template>
          <!-- 名次列 -->
          <template v-if="column.key === 'rank'">
            第 {{ (record as EventScoreDetailVO).rank }} 名
          </template>
          <!-- 成绩列 -->
          <template v-if="column.key === 'score'">
            {{ (record as EventScoreDetailVO).score || '-' }}
          </template>
          <!-- 奖牌列 -->
          <template v-if="column.key === 'medalType'">
            <a-tag
              v-if="(record as EventScoreDetailVO).medalType !== 'NONE'"
              :color="MEDAL_COLOR_MAP[(record as EventScoreDetailVO).medalType] ?? 'default'"
            >
              {{ MEDAL_LABEL_MAP[(record as EventScoreDetailVO).medalType] ?? (record as EventScoreDetailVO).medalType }}
            </a-tag>
            <span v-else>—</span>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="暂无成绩明细" />
        </template>
      </a-table>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import { getCollegeDetail } from '@/api/ranking'
import type {
  CollegeScoreDetailVO,
  EventScoreDetailVO,
} from '@/views/ranking/types'
import {
  MEDAL_LABEL_MAP,
  MEDAL_COLOR_MAP,
  EVENT_TYPE_LABEL,
  EVENT_TYPE_COLOR,
} from '@/views/ranking/constants'

// === Route ===
const route = useRoute()
const router = useRouter()

/** 路径参数 collegeId → number */
const collegeId = computed<number>(() => {
  const raw = route.params.collegeId
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) ? n : 0
})

// === Data state ===
const loading = ref(false)
const data = ref<CollegeScoreDetailVO | null>(null)

const eventDetails = computed<EventScoreDetailVO[]>(
  () => data.value?.eventScoreDetails ?? [],
)

// === Table columns ===
const columns: TableColumnsType = [
  { title: '项目名', dataIndex: 'eventName', key: 'eventName' },
  { title: '类型', key: 'eventType', width: 90, align: 'center' },
  { title: '运动员', key: 'athleteName', width: 160 },
  { title: '名次', key: 'rank', width: 90 },
  { title: '成绩', key: 'score', width: 120 },
  { title: '积分', dataIndex: 'points', key: 'points', width: 90 },
  { title: '奖牌', key: 'medalType', width: 100, align: 'center' },
]

// === 奖牌统计展示 ===
interface MedalStatItem {
  key: string
  label: string
  color: string
  count: number
}

const medalDisplayList = computed<MedalStatItem[]>(() => {
  if (!data.value) return []
  return (['GOLD', 'SILVER', 'BRONZE'] as const).map((k) => ({
    key: k,
    label: MEDAL_LABEL_MAP[k] ?? k,
    color: MEDAL_COLOR_MAP[k] ?? 'default',
    count:
      k === 'GOLD'
        ? data.value!.goldCount
        : k === 'SILVER'
          ? data.value!.silverCount
          : data.value!.bronzeCount,
  }))
})

// === Data loading ===
async function loadData() {
  if (!collegeId.value) {
    message.warning('缺少学院 ID')
    return
  }
  loading.value = true
  try {
    data.value = await getCollegeDetail(collegeId.value)
  } catch {
    // 拦截器统一弹窗
  } finally {
    loading.value = false
  }
}

// === Back handler ===
function handleBack() {
  router.push('/ranking')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.ranking-detail-page {
  .breadcrumb-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: @space-md;
  }

  .page-header {
    margin-bottom: @space-md;

    .title {
      margin: 0 0 @space-sm 0;
      font-size: @font-size-h2;
      font-weight: 600;
    }

    .meta-desc {
      :deep(.ant-descriptions-item-label) {
        color: @text-secondary;
      }

      .total-points {
        font-size: @font-size-h3;
        font-weight: 600;
      }
    }
  }

  .medal-stats {
    margin-bottom: @space-md;

    .medal-item {
      display: inline-flex;
      align-items: center;
      gap: @space-sm;

      .medal-tag {
        margin: 0;
      }

      .medal-count {
        font-size: @font-size-h3;
        font-weight: 600;
      }
    }

    .meta-stat {
      display: inline-flex;
      flex-direction: column;
      gap: 2px;

      .meta-label {
        color: @text-secondary;
        font-size: @font-size-sm;
      }

      .meta-value {
        font-size: @font-size-h3;
        font-weight: 600;
      }
    }
  }
}
</style>