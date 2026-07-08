<template>
  <div class="athlete-arrange-tab">
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-button
        v-if="userStore.isAdmin"
        type="primary"
        :disabled="!competitionId"
        @click="handleOpenAdd"
      >
        添加运动员
      </a-button>
      <a-button @click="loadParticipants">刷新</a-button>
      <span class="toolbar-tip">共 {{ arrangedList.length }} 名已编排运动员</span>
    </div>

    <!-- 已编排运动员表格 -->
    <a-table
      :columns="columns"
      :data-source="arragedList"
      :loading="loading"
      row-key="participationId"
      :pagination="{ pageSize: 15 }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'laneNo'">
          {{ (record as ParticipantArrangement).laneNo ?? '-' }}
        </template>
        <template v-if="column.key === 'bibNumber'">
          {{ (record as ParticipantArrangement).bibNumber ?? '-' }}
        </template>
        <template v-if="column.key === 'action'">
          <a-popconfirm
            title="确认移除该运动员的编排？"
            ok-text="移除"
            cancel-text="取消"
            @confirm="handleRemove(record as ParticipantArrangement)"
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
        <a-empty description="暂无已编排运动员" />
      </template>
    </a-table>

    <!-- 添加运动员 Modal -->
    <a-modal
      v-model:open="modalVisible"
      title="添加运动员"
      width="960px"
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
          placeholder="搜索运动员姓名 / 学号"
          allow-clear
          style="width: 280px"
        />
        <span class="modal-tip">
          已选 {{ selectedRowKeys.length }} 名 · 需填写道次与号码
        </span>
      </div>

      <!-- 候选运动员表格 -->
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
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'laneNo'">
            <a-input-number
              :value="laneMap[(record as ParticipationVO).id] ?? null"
              :min="1"
              :max="20"
              placeholder="道次"
              style="width: 80px"
              @change="(v: number | null) => setLane((record as ParticipationVO).id, v)"
            />
          </template>
          <template v-if="column.key === 'bibNumber'">
            <a-input
              :value="bibMap[(record as ParticipationVO).id] ?? ''"
              placeholder="号码牌"
              :maxlength="20"
              style="width: 120px"
              @input="(e: any) => setBib((record as ParticipationVO).id, e?.target?.value ?? '')"
            />
          </template>
        </template>
        <template #emptyText>
          <a-empty description="无可添加的参赛记录" />
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnsType, TableProps } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import {
  getParticipants,
  arrangeParticipants,
  removeParticipant,
  getCompetition,
} from '@/api/competition'
import {
  getParticipationListApi,
  type ParticipationVO,
} from '@/api/participation'
import type {
  ParticipantArrangement,
  ArrangeItem,
} from '@/views/schedule/types'

// ===== Props =====
const props = defineProps<{
  competitionId: number
}>()

// ===== Store =====
const userStore = useUserStore()

// ===== 已编排列表 state =====
const loading = ref(false)
const arrangedList = ref<ParticipantArrangement[]>([])

// ===== 添加 Modal state =====
const modalVisible = ref(false)
const submitLoading = ref(false)
const candidateLoading = ref(false)
const candidateList = ref<ParticipationVO[]>([])
const searchKeyword = ref('')
// 道次 / 号码 编辑映射（按 participationId 即 record.id 索引）
const laneMap = reactive<Record<number, number | null>>({})
const bibMap = reactive<Record<number, string>>({})

/** 当前场次对应的项目 ID（首次打开 Modal 时从 competition detail 拉取并缓存） */
const eventId = ref<number | null>(null)

// ===== 表格列定义 =====
const columns: TableColumnsType = [
  { title: '运动员', dataIndex: 'athleteName', key: 'athleteName', width: 140 },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '道次', key: 'laneNo', width: 90 },
  { title: '号码', dataIndex: 'bibNumber', key: 'bibNumber', width: 120 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' },
]

const candidateColumns: TableColumnsType = [
  { title: '运动员', dataIndex: 'athleteName', key: 'athleteName', width: 120 },
  { title: '学号', dataIndex: 'studentNo', key: 'studentNo', width: 130 },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '道次', key: 'laneNo', width: 110 },
  { title: '号码', key: 'bibNumber', width: 150 },
]

// ===== 行选择 =====
const selectedRowKeys = ref<number[]>([])

const rowSelection = computed<TableProps['rowSelection']>(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys) => {
    selectedRowKeys.value = keys as number[]
    // 清理已取消选择项的编辑值，避免脏数据残留
    const keep = new Set(selectedRowKeys.value)
    for (const k of Object.keys(laneMap)) {
      const n = Number(k)
      if (!keep.has(n)) {
        delete laneMap[n]
        delete bibMap[n]
      }
    }
  },
}))

// ===== 派生数据 =====
/** 搜索过滤后的候选列表 */
const filteredCandidates = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return candidateList.value
  return candidateList.value.filter((p) => {
    return (
      p.athleteName?.toLowerCase().includes(kw) ||
      p.studentNo?.toLowerCase().includes(kw)
    )
  })
})

// ===== 数据加载 =====
/** 加载已编排运动员列表 */
async function loadParticipants() {
  if (!props.competitionId) {
    arrangedList.value = []
    return
  }
  loading.value = true
  try {
    arrangedList.value = await getParticipants(props.competitionId)
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

/** 加载候选参赛记录（同项目 + 未编排 competitionId=null） */
async function loadCandidates() {
  candidateLoading.value = true
  try {
    const eid = await ensureEventId()
    // 拉取该项目下全部参赛记录（size 上限放大，保证一次取全）
    const page = await getParticipationListApi({ eventId: eid, size: 1000 })
    // 仅展示尚未编排的（competitionId 为 null）
    candidateList.value = page.records.filter((p) => p.competitionId === null)
  } finally {
    candidateLoading.value = false
  }
}

// ===== 交互处理 =====
/** 打开添加 Modal */
async function handleOpenAdd() {
  // 重置状态
  searchKeyword.value = ''
  selectedRowKeys.value = []
  Object.keys(laneMap).forEach((k) => delete laneMap[Number(k)])
  Object.keys(bibMap).forEach((k) => delete bibMap[Number(k)])
  modalVisible.value = true
  // 并行拉取候选；eventId 缓存命中时仅请求一次 list
  await loadCandidates()
}

/** 设置道次 */
function setLane(id: number, v: number | null) {
  laneMap[id] = v
}

/** 设置号码 */
function setBib(id: number, v: string) {
  bibMap[id] = v
}

/** 提交编排 */
async function handleSubmit() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请至少选择一名运动员')
    return
  }
  // 校验：道次与号码均必填
  for (const id of selectedRowKeys.value) {
    const lane = laneMap[id]
    const bib = bibMap[id]
    if (lane === undefined || lane === null || bib === undefined || bib === '') {
      const p = candidateList.value.find((c) => c.id === id)
      message.warning(
        `请为「${p?.athleteName ?? id}」填写道次与号码`,
      )
      return
    }
  }
  // 构造 DTO
  const participants: ArrangeItem[] = selectedRowKeys.value.map((id) => ({
    participationId: id,
    laneNo: laneMap[id] ?? undefined,
    bibNumber: bibMap[id] ?? undefined,
  }))
  submitLoading.value = true
  try {
    await arrangeParticipants(props.competitionId, { participants })
    message.success(`成功编排 ${participants.length} 名运动员`)
    modalVisible.value = false
    await loadParticipants()
  } finally {
    submitLoading.value = false
  }
}

function handleModalClose() {
  // 关闭时清理编辑态，避免下次打开残留
  selectedRowKeys.value = []
  searchKeyword.value = ''
  Object.keys(laneMap).forEach((k) => delete laneMap[Number(k)])
  Object.keys(bibMap).forEach((k) => delete bibMap[Number(k)])
}

/** 移除编排（Popconfirm 确认后调用） */
async function handleRemove(record: ParticipantArrangement) {
  await removeParticipant(props.competitionId, record.participationId)
  message.success('已移除')
  await loadParticipants()
}

// ===== 生命周期 / Watch =====
/** competitionId 变化时重新加载已编排列表 */
watch(
  () => props.competitionId,
  (val) => {
    // 切换场次后清空 eventId 缓存，确保候选列表对应正确项目
    eventId.value = null
    if (val) {
      loadParticipants()
    } else {
      arrangedList.value = []
    }
  },
)

onMounted(() => {
  loadParticipants()
})
</script>

<style scoped lang="less">
.athlete-arrange-tab {
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
