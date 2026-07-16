<template>
  <div class="score-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-input-number
          v-model:value="filters.competitionId"
          placeholder="比赛场次 ID"
          :min="1"
          :precision="0"
          allow-clear
          style="width: 180px"
        />
        <a-input-number
          v-model:value="filters.eventId"
          placeholder="项目 ID"
          :min="1"
          :precision="0"
          allow-clear
          style="width: 180px"
        />
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Table with server-side pagination -->
    <a-table
      :columns="columns"
      :data-source="scoreList"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <!-- AthleteName column（团体成绩为 null → 显示"团体"） -->
        <template v-if="column.key === 'athleteName'">
          {{ (record as ScoreVO).athleteName ?? '团体' }}
        </template>
        <!-- Rank column（名次 + 奖牌色标） -->
        <template v-if="column.key === 'rank'">
          <a-tag :color="medalColorOf((record as ScoreVO).rank)">
            第 {{ (record as ScoreVO).rank }} 名
          </a-tag>
        </template>
        <!-- IsRecordBreaking column（破纪录高亮） -->
        <template v-if="column.key === 'isRecordBreaking'">
          <a-tag :color="IS_RECORD_BREAKING_COLOR_MAP[(record as ScoreVO).isRecordBreaking]">
            {{ IS_RECORD_BREAKING_MAP[(record as ScoreVO).isRecordBreaking] }}
          </a-tag>
        </template>
        <!-- CreatedAt column -->
        <template v-if="column.key === 'createdAt'">
          {{ (record as ScoreVO).createdAt ? dayjs((record as ScoreVO).createdAt).format('YYYY-MM-DD HH:mm:ss') : '-' }}
        </template>
        <!-- Action column -->
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              size="small"
              @click="handleEdit(record as ScoreVO)"
            >
              编辑
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
              @click="handleDelete(record as ScoreVO)"
            >
              删除
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="modalTitle"
      :confirm-loading="submitLoading"
      @ok="handleSubmit"
      @cancel="handleModalClose"
    >
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
        style="margin-top: 16px"
      >
        <a-form-item label="名次" name="rank">
          <a-input-number
            v-model:value="formState.rank"
            :min="1"
            :precision="0"
            placeholder="请输入名次"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="成绩数值" name="scoreValue">
          <a-input-number
            v-model:value="formState.scoreValue"
            placeholder="请输入成绩数值"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="成绩展示" name="scoreDisplay">
          <a-input
            v-model:value="formState.scoreDisplay"
            placeholder="如 12.34s / 5.67m"
            :maxlength="50"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import {
  getScorePage,
  updateScore,
  deleteScoreById,
} from '@/api/score'
import type {
  ScoreVO,
  ScoreQueryDTO,
  ScoreUpdateDTO,
} from '@/views/score/types'
import {
  IS_RECORD_BREAKING_MAP,
  IS_RECORD_BREAKING_COLOR_MAP,
  MEDAL_MAP,
  MEDAL_COLOR_MAP,
} from '@/views/score/constants'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const scoreList = ref<ScoreVO[]>([])
const loading = ref(false)

// === Pagination config（内联，与 athlete/participation 模式一致；
//     useCrud 硬编码 current 参数，与 ScoreQueryDTO 的 page 字段不匹配，故手写） ===
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
})

// === Filter bar state ===
const filters = reactive<ScoreQueryDTO>({
  competitionId: undefined,
  eventId: undefined,
})

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const editingId = ref<number | null>(null)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// === Form state ===
const formState = reactive({
  rank: undefined as number | undefined,
  scoreValue: undefined as number | undefined,
  scoreDisplay: '' as string,
})

// === Form rules ===
const rules = {
  rank: [{ required: true, message: '请输入名次', trigger: 'blur' }],
  scoreValue: [{ required: true, message: '请输入成绩数值', trigger: 'blur' }],
  scoreDisplay: [{ required: true, message: '请输入成绩展示文本', trigger: 'blur' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '运动员', dataIndex: 'athleteName', key: 'athleteName' },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '项目', dataIndex: 'eventName', key: 'eventName' },
  { title: '名次', dataIndex: 'rank', key: 'rank', width: 100 },
  { title: '积分', dataIndex: 'points', key: 'points', width: 80 },
  { title: '成绩', dataIndex: 'scoreDisplay', key: 'scoreDisplay' },
  { title: '破纪录', dataIndex: 'isRecordBreaking', key: 'isRecordBreaking', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action', width: 150 },
]

// === 奖牌 Tag 配色（1→金, 2→银, 3→铜, 其余默认） ===
function medalColorOf(rank: number): string {
  const medal = MEDAL_MAP[rank]
  return medal ? MEDAL_COLOR_MAP[medal] : 'default'
}

// === Data loading（参数名 page/size 与后端 ScoreQueryDTO 对齐） ===
async function loadList() {
  loading.value = true
  try {
    const result = await getScorePage({
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      competitionId: filters.competitionId,
      eventId: filters.eventId,
    })
    scoreList.value = result.records
    paginationConfig.total = result.total
  } finally {
    loading.value = false
  }
}

// === Filter handlers ===
function handleSearch() {
  paginationConfig.current = 1
  loadList()
}

function handleReset() {
  Object.assign(filters, {
    competitionId: undefined,
    eventId: undefined,
  })
  paginationConfig.current = 1
  loadList()
}

// === Table pagination change ===
function handleTableChange(pag: { current?: number; pageSize?: number }) {
  if (pag.current) paginationConfig.current = pag.current
  if (pag.pageSize) paginationConfig.pageSize = pag.pageSize
  loadList()
}

// === Edit handler ===
function handleEdit(record: ScoreVO) {
  modalTitle.value = '编辑成绩'
  editingId.value = record.id
  Object.assign(formState, {
    rank: record.rank,
    scoreValue: record.scoreValue,
    scoreDisplay: record.scoreDisplay,
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (editingId.value === null) return
  try {
    await formRef.value?.validateFields()
    submitLoading.value = true
    const dto: ScoreUpdateDTO = {
      rank: formState.rank,
      scoreValue: formState.scoreValue,
      scoreDisplay: formState.scoreDisplay,
    }
    await updateScore(editingId.value, dto)
    message.success('修改成功')
    modalVisible.value = false
    await loadList()
  } finally {
    submitLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
}

// === Delete handler（Modal.confirm 确认） ===
function handleDelete(record: ScoreVO) {
  const subject = record.athleteName ?? `团体·${record.collegeName}`
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除「${subject}」的「${record.eventName}」成绩吗？此操作不可撤销。`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      await deleteScoreById(record.id)
      message.success('删除成功')
      await loadList()
    },
  })
}

// === Lifecycle ===
onMounted(() => {
  loadList()
})
</script>

<style scoped lang="less">
.score-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
}
</style>
