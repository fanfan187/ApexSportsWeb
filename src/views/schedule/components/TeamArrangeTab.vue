<template>
  <div class="team-arrange-tab">
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-button
        v-if="userStore.isAdmin"
        type="primary"
        :disabled="!competitionId"
        @click="handleOpenAdd"
      >
        添加团体
      </a-button>
      <a-button @click="loadTeamParticipants">刷新</a-button>
      <span class="toolbar-tip">共 {{ arrangedList.length }} 个已编排团体</span>
    </div>

    <!-- 已编排团体表格 -->
    <a-table
      :columns="columns"
      :data-source="arragedList"
      :loading="loading"
      row-key="teamParticipationId"
      :pagination="{ pageSize: 15 }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-popconfirm
            title="确认移除该团体的编排？"
            ok-text="移除"
            cancel-text="取消"
            @confirm="handleRemove(record as TeamParticipantArrangement)"
          >
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
            >
              移除
            </a-button>
          </a-popconfirm>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="暂无已编排团体" />
      </template>
    </a-table>

    <!-- 添加团体 Modal -->
    <a-modal
      v-model:open="modalVisible"
      title="添加团体"
      width="860px"
      :confirm-loading="submitLoading"
      ok-text="提交编排"
      cancel-text="取消"
      @ok="handleSubmit"
      @cancel="handleModalClose"
    >
      <!-- 搜索框 -->
      <div class="modal-toolbar">
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索学院名称"
          allow-clear
          style="width: 280px"
        />
        <span class="modal-tip">已选 {{ selectedRowKeys.length }} 个团体</span>
      </div>

      <!-- 候选团体表格 -->
      <a-table
        :columns="candidateColumns"
        :data-source="filteredCandidates"
        :loading="candidateLoading"
        :row-selection="rowSelection"
        row-key="id"
        size="small"
        :pagination="{ pageSize: 8 }"
        :scroll="{ y: 320 }"
      >
        <template #emptyText>
          <a-empty description="无可添加的团体参赛记录" />
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnsType, TableProps } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import {
  getCompetition,
  arrangeTeamParticipants,
  removeTeamParticipant,
} from '@/api/competition'
import {
  getTeamParticipationListApi,
  type TeamParticipationVO,
} from '@/api/team-participation'
import type {
  TeamParticipantArrangement,
  TeamArrangeItem,
} from '@/views/schedule/types'

// ===== Props =====
const props = defineProps<{
  competitionId: number
}>()

// ===== Store =====
const userStore = useUserStore()

// ===== 已编排列表 state =====
const loading = ref(false)
const arrangedList = ref<TeamParticipantArrangement[]>([])

// ===== 添加 Modal state =====
const modalVisible = ref(false)
const submitLoading = ref(false)
const candidateLoading = ref(false)
const candidateList = ref<TeamParticipationVO[]>([])
const searchKeyword = ref('')

/** 当前场次对应的项目 ID（首次打开 Modal 时从 competition detail 拉取并缓存） */
const eventId = ref<number | null>(null)

// ===== 表格列定义 =====
const columns: TableColumnsType = [
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '参赛人数', dataIndex: 'participantCount', key: 'participantCount', width: 120 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' },
]

const candidateColumns: TableColumnsType = [
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '项目', dataIndex: 'eventName', key: 'eventName' },
  { title: '参赛人数', dataIndex: 'participantCount', key: 'participantCount', width: 110 },
]

// ===== 行选择 =====
const selectedRowKeys = ref<number[]>([])

const rowSelection = computed<TableProps['rowSelection']>(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys) => {
    selectedRowKeys.value = keys as number[]
  },
}))

// ===== 派生数据 =====
/** 搜索过滤后的候选列表 */
const filteredCandidates = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return candidateList.value
  return candidateList.value.filter((p) =>
    p.collegeName?.toLowerCase().includes(kw),
  )
})

// ===== 数据加载 =====
/**
 * 加载已编排团体列表
 *
 * 后端无独立 getTeamParticipants 接口，
 * 通过 getCompetition(id) 获取 detail.teamParticipantArrangements。
 */
async function loadTeamParticipants() {
  if (!props.competitionId) {
    arrangedList.value = []
    return
  }
  loading.value = true
  try {
    const detail = await getCompetition(props.competitionId)
    arrangedList.value = detail.teamParticipantArrangements ?? []
  } finally {
    loading.value = false
  }
}

/** 拉取当前场次对应 eventId（缓存） */
async function ensureEventId(): Promise<number> {
  if (eventId.value !== null) return eventId.value
  const detail = await getCompetition(props.competitionId)
  eventId.value = detail.competition.eventId
  return eventId.value
}

/** 加载候选团体参赛记录（同项目 + 未编排 competitionId=null） */
async function loadCandidates() {
  candidateLoading.value = true
  try {
    const eid = await ensureEventId()
    const page = await getTeamParticipationListApi({ eventId: eid, size: 1000 })
    // 仅展示尚未编排的（competitionId 为 null）
    candidateList.value = page.records.filter((p) => p.competitionId === null)
  } finally {
    candidateLoading.value = false
  }
}

// ===== 交互处理 =====
/** 打开添加 Modal */
async function handleOpenAdd() {
  searchKeyword.value = ''
  selectedRowKeys.value = []
  modalVisible.value = true
  await loadCandidates()
}

/** 提交编排 */
async function handleSubmit() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请至少选择一个团体')
    return
  }
  const teamParticipants: TeamArrangeItem[] = selectedRowKeys.value.map((id) => ({
    teamParticipationId: id,
  }))
  submitLoading.value = true
  try {
    await arrangeTeamParticipants(props.competitionId, { teamParticipants })
    message.success(`成功编排 ${teamParticipants.length} 个团体`)
    modalVisible.value = false
    await loadTeamParticipants()
  } finally {
    submitLoading.value = false
  }
}

function handleModalClose() {
  selectedRowKeys.value = []
  searchKeyword.value = ''
}

/** 移除编排（Popconfirm 确认后调用） */
async function handleRemove(record: TeamParticipantArrangement) {
  await removeTeamParticipant(props.competitionId, record.teamParticipationId)
  message.success('已移除')
  await loadTeamParticipants()
}

// ===== 生命周期 / Watch =====
/** competitionId 变化时重新加载已编排列表 */
watch(
  () => props.competitionId,
  (val) => {
    // 切换场次后清空 eventId 缓存，确保候选列表对应正确项目
    eventId.value = null
    if (val) {
      loadTeamParticipants()
    } else {
      arrangedList.value = []
    }
  },
)

onMounted(() => {
  loadTeamParticipants()
})
</script>

<style scoped lang="less">
.team-arrange-tab {
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

  .modal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: @space-md;

    .modal-tip {
      color: @text-secondary;
      font-size: @font-size-sm;
    }
  }
}
</style>
