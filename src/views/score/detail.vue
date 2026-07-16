<template>
  <div class="score-detail-page">
    <!-- Breadcrumb -->
    <a-breadcrumb class="breadcrumb">
      <a-breadcrumb-item>
        <router-link to="/score">成绩管理</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>比赛成绩汇总</a-breadcrumb-item>
    </a-breadcrumb>

    <!-- Header: 比赛信息 -->
    <div class="page-header">
      <a-spin :spinning="loading">
        <div v-if="data" class="header-content">
          <h2 class="title">
            <span class="title-name">{{ data.competitionName }}</span>
            <a-divider type="vertical" />
            <span class="title-meta">{{ data.eventName }}</span>
          </h2>
          <a-descriptions :column="3" size="small" class="meta-desc">
            <a-descriptions-item label="比赛场次 ID">
              {{ data.competitionId }}
            </a-descriptions-item>
            <a-descriptions-item label="总成绩记录数">
              {{ data.totalRecords }}
            </a-descriptions-item>
            <a-descriptions-item label="排名条目数">
              {{ data.rankings.length }}
            </a-descriptions-item>
          </a-descriptions>
        </div>
        <a-skeleton v-else :title="{ width: '40%' }" :paragraph="{ rows: 1 }" active />
      </a-spin>
    </div>

    <!-- 奖牌统计 -->
    <div v-if="data && medalStats" class="medal-stats">
      <a-card size="small" title="奖牌统计" class="medal-card">
        <a-space size="large">
          <div
            v-for="medal in medalDisplayList"
            :key="medal.key"
            class="medal-item"
          >
            <a-tag :color="medal.color" class="medal-tag">
              {{ medal.label }}
            </a-tag>
            <span class="medal-count">{{ medal.count }}</span>
          </div>
        </a-space>
      </a-card>
    </div>

    <!-- 排名列表 -->
    <a-table
      :columns="columns"
      :data-source="rankings"
      :loading="loading"
      row-key="id"
      :pagination="false"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'rank'">
          <a-tag
            v-if="(record as ScoreItemVO).rank <= 3"
            :color="medalColorFor((record as ScoreItemVO).rank)"
          >
            第 {{ (record as ScoreItemVO).rank }} 名
          </a-tag>
          <span v-else>第 {{ (record as ScoreItemVO).rank }} 名</span>
        </template>
        <template v-if="column.key === 'athleteName'">
          {{ (record as ScoreItemVO).athleteName ?? '（团体成绩）' }}
        </template>
        <template v-if="column.key === 'isIndividual'">
          <a-tag v-if="(record as ScoreItemVO).participationId !== null" color="blue">
            个人
          </a-tag>
          <a-tag v-else color="purple">团体</a-tag>
        </template>
        <template v-if="column.key === 'scoreDisplay'">
          {{ (record as ScoreItemVO).scoreDisplay || '-' }}
        </template>
        <template v-if="column.key === 'points'">
          {{ (record as ScoreItemVO).points ?? '-' }}
        </template>
        <template v-if="column.key === 'isRecordBreaking'">
          <a-tag
            :color="
              IS_RECORD_BREAKING_COLOR_MAP[(record as ScoreItemVO).isRecordBreaking] ?? 'default'
            "
          >
            {{ IS_RECORD_BREAKING_MAP[(record as ScoreItemVO).isRecordBreaking] ?? '未知' }}
          </a-tag>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="暂无成绩记录" />
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import { getCompetitionScores } from '@/api/score'
import type {
  CompetitionScoreVO,
  ScoreItemVO,
} from '@/views/score/types'
import {
  IS_RECORD_BREAKING_MAP,
  IS_RECORD_BREAKING_COLOR_MAP,
  MEDAL_MAP,
  MEDAL_LABEL_MAP,
  MEDAL_COLOR_MAP,
} from '@/views/score/constants'

// ===== Route =====
const route = useRoute()

/** 路径参数 id → number（路由未注册时兜底 0） */
const competitionId = computed<number>(() => {
  const raw = route.params.competitionId ?? route.params.id
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) ? n : 0
})

// ===== Data state =====
const loading = ref(false)
const data = ref<CompetitionScoreVO | null>(null)

const rankings = computed<ScoreItemVO[]>(() => data.value?.rankings ?? [])

// ===== Table columns =====
const columns: TableColumnsType = [
  { title: '名次', key: 'rank', width: 110 },
  { title: '类型', key: 'isIndividual', width: 80 },
  { title: '运动员', key: 'athleteName', width: 140 },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '成绩展示', key: 'scoreDisplay', width: 140 },
  { title: '积分', key: 'points', width: 90 },
  { title: '破纪录', key: 'isRecordBreaking', width: 100 },
]

// ===== 奖牌统计 =====
interface MedalStatItem {
  key: string
  label: string
  color: string
  count: number
}

const medalStats = computed(() => {
  if (!data.value || data.value.rankings.length === 0) return null
  const counts: Record<string, number> = { GOLD: 0, SILVER: 0, BRONZE: 0 }
  for (const r of data.value.rankings) {
    const medalKey = MEDAL_MAP[r.rank]
    if (medalKey && counts[medalKey] !== undefined) {
      counts[medalKey] += 1
    }
  }
  return counts
})

const medalDisplayList = computed<MedalStatItem[]>(() => {
  const base = medalStats.value
  if (!base) return []
  return (['GOLD', 'SILVER', 'BRONZE'] as const).map((k) => ({
    key: k,
    label: MEDAL_LABEL_MAP[k] ?? k,
    color: MEDAL_COLOR_MAP[k] ?? 'default',
    count: base[k],
  }))
})

function medalColorFor(rank: number): string {
  const medalKey = MEDAL_MAP[rank]
  return medalKey ? MEDAL_COLOR_MAP[medalKey] ?? 'default' : 'default'
}

// ===== 数据加载 =====
async function loadData() {
  if (!competitionId.value) {
    message.warning('缺少比赛场次 ID')
    return
  }
  loading.value = true
  try {
    data.value = await getCompetitionScores(competitionId.value)
  } catch {
    // 拦截器统一弹窗，此处仅终止 loading
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="less">
.score-detail-page {
  .breadcrumb {
    margin-bottom: @space-md;
  }

  .page-header {
    margin-bottom: @space-md;

    .header-content {
      .title {
        margin: 0 0 @space-sm 0;
        font-size: @font-size-h2;
        line-height: 1.4;

        .title-name {
          font-weight: 600;
        }

        .title-meta {
          color: @text-secondary;
          font-weight: 400;
        }
      }

      .meta-desc {
        :deep(.ant-descriptions-item-label) {
          color: @text-secondary;
        }
      }
    }
  }

  .medal-stats {
    margin-bottom: @space-md;

    .medal-card {
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
    }
  }
}
</style>
