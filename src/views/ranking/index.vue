<template>
  <div class="ranking-page">
    <!-- Header bar -->
    <div class="header-bar">
      <a-button
        v-if="userStore.isAdmin"
        type="primary"
        :loading="refreshLoading"
        @click="handleRefresh"
      >
        刷新积分
      </a-button>
    </div>

    <!-- Ranking table（无分页，按 ranking ASC 直接展示） -->
    <a-table
      :columns="columns"
      :data-source="rankings"
      :loading="loading"
      :pagination="false"
      row-key="collegeId"
    >
      <template #bodyCell="{ column, record }">
        <!-- 排名列 -->
        <template v-if="column.key === 'ranking'">
          <a-tag v-if="(record as CollegeRankingVO).ranking !== null" color="blue">
            第 {{ (record as CollegeRankingVO).ranking }} 名
          </a-tag>
          <span v-else>—</span>
        </template>
        <!-- 金牌列 -->
        <template v-if="column.key === 'goldCount'">
          <a-tag :color="MEDAL_COLOR_MAP.GOLD">
            {{ (record as CollegeRankingVO).goldCount }}
          </a-tag>
        </template>
        <!-- 银牌列 -->
        <template v-if="column.key === 'silverCount'">
          <a-tag :color="MEDAL_COLOR_MAP.SILVER">
            {{ (record as CollegeRankingVO).silverCount }}
          </a-tag>
        </template>
        <!-- 铜牌列 -->
        <template v-if="column.key === 'bronzeCount'">
          <a-tag :color="MEDAL_COLOR_MAP.BRONZE">
            {{ (record as CollegeRankingVO).bronzeCount }}
          </a-tag>
        </template>
        <!-- 操作列 -->
        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="handleDetail(record as CollegeRankingVO)">
            详情
          </a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import {
  getCollegeRankings,
  refreshCollegeScores,
} from '@/api/ranking'
import type { CollegeRankingVO } from '@/views/ranking/types'
import { MEDAL_COLOR_MAP } from '@/views/ranking/constants'

// === Store ===
const userStore = useUserStore()
const router = useRouter()

// === Table state ===
const rankings = ref<CollegeRankingVO[]>([])
const loading = ref(false)
const refreshLoading = ref(false)

// === Table columns ===
const columns: TableColumnsType = [
  { title: '排名', key: 'ranking', width: 110 },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '学院代码', dataIndex: 'collegeCode', key: 'collegeCode', width: 120 },
  { title: '总积分', dataIndex: 'totalPoints', key: 'totalPoints', width: 100 },
  { title: '金牌', key: 'goldCount', width: 90, align: 'center' },
  { title: '银牌', key: 'silverCount', width: 90, align: 'center' },
  { title: '铜牌', key: 'bronzeCount', width: 90, align: 'center' },
  { title: '个人积分', dataIndex: 'individualPoints', key: 'individualPoints', width: 110 },
  { title: '团体积分', dataIndex: 'teamPoints', key: 'teamPoints', width: 110 },
  { title: '操作', key: 'action', width: 100 },
]

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    rankings.value = await getCollegeRankings()
  } finally {
    loading.value = false
  }
}

// === Detail handler ===
function handleDetail(record: CollegeRankingVO) {
  router.push(`/ranking/${record.collegeId}`)
}

// === Refresh handler（管理员，Modal.confirm 二次确认） ===
function handleRefresh() {
  Modal.confirm({
    title: '刷新学院积分',
    content: '将基于当前成绩重新汇总学院积分，可能需要数秒。是否继续？',
    okText: '确认刷新',
    cancelText: '取消',
    onOk: async () => {
      refreshLoading.value = true
      try {
        const result = await refreshCollegeScores()
        message.success(
          `刷新成功：共 ${result.affectedColleges} 个学院、${result.totalEvents} 个项目已重新汇总`,
        )
        await loadList()
      } finally {
        refreshLoading.value = false
      }
    },
  })
}

// === Lifecycle ===
onMounted(() => {
  loadList()
})
</script>

<style scoped lang="less">
.ranking-page {
  .header-bar {
    margin-bottom: @space-md;
    text-align: right;
  }
}
</style>