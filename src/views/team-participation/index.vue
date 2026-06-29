<template>
  <div class="team-participation-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-select
          v-model:value="filters.collegeId"
          placeholder="学院"
          allowClear
          style="width: 180px"
        >
          <a-select-option
            v-for="c in collegeOptions"
            :key="c.id"
            :value="c.id"
          >
            {{ c.name }}
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.eventId"
          placeholder="集体项目"
          allowClear
          style="width: 180px"
        >
          <a-select-option
            v-for="e in eventOptions"
            :key="e.id"
            :value="e.id"
          >
            {{ e.name }}
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allowClear
          style="width: 140px"
        >
          <a-select-option :value="0">已报名</a-select-option>
          <a-select-option :value="1">检录通过</a-select-option>
          <a-select-option :value="2">已参赛</a-select-option>
          <a-select-option :value="3">弃权</a-select-option>
          <a-select-option :value="4">取消资格</a-select-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Header with Add button (admin only) -->
    <div class="page-header">
      <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
        新增集体参赛
      </a-button>
    </div>

    <!-- Table with server-side pagination -->
    <a-table
      :columns="columns"
      :data-source="teamList"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <!-- ParticipantCount column -->
        <template v-if="column.key === 'participantCount'">
          {{ (record as TeamParticipationVO).participantCount }} 人
        </template>
        <!-- CompetitionId column -->
        <template v-if="column.key === 'competitionId'">
          {{ (record as TeamParticipationVO).competitionId ?? '-' }}
        </template>
        <!-- Status column -->
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor((record as TeamParticipationVO).status)">
            {{ getStatusLabel((record as TeamParticipationVO).status) }}
          </a-tag>
        </template>
        <!-- CreatedAt column -->
        <template v-if="column.key === 'createdAt'">
          {{ (record as TeamParticipationVO).createdAt ? dayjs((record as TeamParticipationVO).createdAt).format('YYYY-MM-DD HH:mm:ss') : '-' }}
        </template>
        <!-- Action column -->
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="userStore.isAdmin && (record as TeamParticipationVO).status === 0"
              type="link"
              danger
              size="small"
              @click="handleCancel(record as TeamParticipationVO)"
            >
              取消
            </a-button>
            <a-button
              v-if="userStore.isAdmin && (record as TeamParticipationVO).status === 0 && (record as TeamParticipationVO).competitionId"
              type="link"
              size="small"
              @click="handleCheckIn(record as TeamParticipationVO)"
            >
              检录
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- Add Modal -->
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
        <a-form-item label="学院" name="collegeId">
          <a-select
            v-model:value="formState.collegeId"
            placeholder="请选择学院"
          >
            <a-select-option
              v-for="c in collegeOptions"
              :key="c.id"
              :value="c.id"
            >
              {{ c.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="集体项目" name="eventId">
          <a-select
            v-model:value="formState.eventId"
            placeholder="请选择集体项目"
            @change="handleEventChange"
          >
            <a-select-option
              v-for="e in eventOptions"
              :key="e.id"
              :value="e.id"
            >
              {{ e.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="参赛人数" name="participantCount">
          <a-input-number
            v-model:value="formState.participantCount"
            :min="1"
            :max="maxParticipants"
            placeholder="请输入参赛人数"
            style="width: 100%"
          />
          <span v-if="maxParticipants" class="max-hint">
            （该项目最多 {{ maxParticipants }} 人）
          </span>
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
  getTeamParticipationListApi,
  createTeamParticipationApi,
  cancelTeamParticipationApi,
  checkInTeamParticipationApi,
  type TeamParticipationVO,
  type TeamParticipationCreateDTO,
  type TeamParticipationQueryParams,
} from '@/api/team-participation'
import { getCollegeListApi, type CollegeVO } from '@/api/college'
import { getEventListApi, type EventVO } from '@/api/event'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const teamList = ref<TeamParticipationVO[]>([])
const loading = ref(false)

// === Pagination config ===
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
})

// === Filter bar state ===
const filters = reactive<TeamParticipationQueryParams>({
  collegeId: undefined,
  eventId: undefined,
  status: undefined,
})

// === Dropdown options ===
const collegeOptions = ref<CollegeVO[]>([])
const eventOptions = ref<EventVO[]>([])

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// === Form state ===
const formState = reactive({
  collegeId: undefined as number | undefined,
  eventId: undefined as number | undefined,
  participantCount: undefined as number | undefined,
})

// === Dynamic max participants based on selected event ===
const maxParticipants = ref<number | undefined>(undefined)

// === Form rules ===
const rules = {
  collegeId: [{ required: true, message: '请选择学院', trigger: 'change' }],
  eventId: [{ required: true, message: '请选择集体项目', trigger: 'change' }],
  participantCount: [{ required: true, message: '请输入参赛人数', trigger: 'blur' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '项目', dataIndex: 'eventName', key: 'eventName' },
  { title: '参赛人数', dataIndex: 'participantCount', key: 'participantCount', width: 110 },
  { title: '比赛场次', dataIndex: 'competitionId', key: 'competitionId', width: 110 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '报名时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 140 },
]

// === Status helper functions ===
function getStatusColor(status: number): string {
  const map: Record<number, string> = {
    0: 'blue',
    1: 'green',
    2: 'default',
    3: 'orange',
    4: 'red',
  }
  return map[status] ?? 'default'
}

function getStatusLabel(status: number): string {
  const map: Record<number, string> = {
    0: '已报名',
    1: '检录通过',
    2: '已参赛',
    3: '弃权',
    4: '取消资格',
  }
  return map[status] ?? '未知'
}

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    const result = await getTeamParticipationListApi({
      current: paginationConfig.current,
      size: paginationConfig.pageSize,
      ...filters,
    })
    teamList.value = result.records
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
    collegeId: undefined,
    eventId: undefined,
    status: undefined,
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

// === Add handler ===
function handleAdd() {
  modalTitle.value = '新增集体参赛'
  Object.assign(formState, {
    collegeId: undefined,
    eventId: undefined,
    participantCount: undefined,
  })
  maxParticipants.value = undefined
  modalVisible.value = true
}

// === Update max participants when event changes ===
function handleEventChange(eventId: number) {
  const selected = eventOptions.value.find((e) => e.id === eventId)
  maxParticipants.value = selected?.maxParticipants ?? undefined
  // 如果当前已填的人数超过新最大值，重置
  if (maxParticipants.value && formState.participantCount && formState.participantCount > maxParticipants.value) {
    formState.participantCount = undefined
  }
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    submitLoading.value = true
    const dto: TeamParticipationCreateDTO = {
      collegeId: formState.collegeId!,
      eventId: formState.eventId!,
      participantCount: formState.participantCount!,
    }
    await createTeamParticipationApi(dto)
    message.success('报名成功')
    modalVisible.value = false
    await loadList()
  } finally {
    submitLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
  maxParticipants.value = undefined
}

// === Cancel handler (status === 0) ===
function handleCancel(record: TeamParticipationVO) {
  Modal.confirm({
    title: '确认取消',
    content: `确定要取消「${record.collegeName} - ${record.eventName}」的参赛报名吗？`,
    okType: 'danger',
    okText: '取消报名',
    cancelText: '再想想',
    onOk: async () => {
      await cancelTeamParticipationApi(record.id)
      message.success('已取消报名')
      await loadList()
    },
  })
}

// === Check-in handler (status === 0 && competitionId not null) ===
function handleCheckIn(record: TeamParticipationVO) {
  Modal.confirm({
    title: '确认检录',
    content: `确定要对「${record.collegeName} - ${record.eventName}」进行检录吗？`,
    okText: '确认检录',
    cancelText: '取消',
    onOk: async () => {
      await checkInTeamParticipationApi(record.id)
      message.success('检录成功')
      await loadList()
    },
  })
}

// === Lifecycle ===
onMounted(() => {
  loadList()
  getCollegeListApi().then((list) => {
    collegeOptions.value = list
  })
  // 集体项目：type === 2
  getEventListApi({ type: 2 }).then((list) => {
    eventOptions.value = list
  })
})
</script>

<style scoped lang="less">
.team-participation-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
  .page-header {
    margin-bottom: @space-md;
  }
  .max-hint {
    margin-left: 8px;
    color: @text-secondary;
    font-size: 12px;
  }
}
</style>
