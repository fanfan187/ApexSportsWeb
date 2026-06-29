<template>
  <div class="participation-page">
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
          placeholder="项目"
          allowClear
          style="width: 180px"
        >
          <a-select-option
            v-for="e in individualEventOptions"
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
        新增报名
      </a-button>
    </div>

    <!-- Table with server-side pagination -->
    <a-table
      :columns="columns"
      :data-source="participationList"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <!-- CompetitionId column -->
        <template v-if="column.key === 'competitionId'">
          {{ (record as ParticipationVO).competitionId ?? '-' }}
        </template>
        <!-- LaneNo column -->
        <template v-if="column.key === 'laneNo'">
          {{ (record as ParticipationVO).laneNo ?? '-' }}
        </template>
        <!-- BibNumber column -->
        <template v-if="column.key === 'bibNumber'">
          {{ (record as ParticipationVO).bibNumber ?? '-' }}
        </template>
        <!-- Status column (inline a-tag) -->
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor((record as ParticipationVO).status)">
            {{ getStatusLabel((record as ParticipationVO).status) }}
          </a-tag>
        </template>
        <!-- CreatedAt column -->
        <template v-if="column.key === 'createdAt'">
          {{ (record as ParticipationVO).createdAt ? dayjs((record as ParticipationVO).createdAt).format('YYYY-MM-DD HH:mm:ss') : '-' }}
        </template>
        <!-- Action column -->
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="userStore.isAdmin && (record as ParticipationVO).status === 0 && (record as ParticipationVO).competitionId"
              type="link"
              size="small"
              @click="handleCheckIn(record as ParticipationVO)"
            >
              检录
            </a-button>
            <a-button
              v-if="userStore.isAdmin && (record as ParticipationVO).status === 0"
              type="link"
              danger
              size="small"
              @click="handleCancel(record as ParticipationVO)"
            >
              取消
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- Add Modal (admin only) -->
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
        <a-form-item label="运动员" name="athleteId">
          <a-select
            v-model:value="formState.athleteId"
            placeholder="请选择运动员"
            show-search
            :filter-option="filterAthleteOption"
          >
            <a-select-option
              v-for="a in athleteOptions"
              :key="a.id"
              :value="a.id"
              :label="`${a.name}（${a.studentNo}）`"
            >
              {{ a.name }}（{{ a.studentNo }}）
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="项目" name="eventId">
          <a-select
            v-model:value="formState.eventId"
            placeholder="请选择个人项目"
          >
            <a-select-option
              v-for="e in individualEventOptions"
              :key="e.id"
              :value="e.id"
            >
              {{ e.name }}
            </a-select-option>
          </a-select>
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
  getParticipationListApi,
  createParticipationApi,
  cancelParticipationApi,
  checkInParticipationApi,
  type ParticipationVO,
  type ParticipationCreateDTO,
  type ParticipationQueryParams,
} from '@/api/participation'
import { getCollegeListApi, type CollegeVO } from '@/api/college'
import { getEventListApi, type EventVO } from '@/api/event'
import { getAthleteListApi, type AthleteVO } from '@/api/athlete'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const participationList = ref<ParticipationVO[]>([])
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
const filters = reactive<ParticipationQueryParams>({
  collegeId: undefined,
  eventId: undefined,
  status: undefined,
})

// === Dropdown options ===
const collegeOptions = ref<CollegeVO[]>([])
const eventOptions = ref<EventVO[]>([])
const athleteOptions = ref<AthleteVO[]>([])

// 个人项目下拉（type === 1）
const individualEventOptions = ref<EventVO[]>([])

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// === Form state ===
const formState = reactive({
  athleteId: undefined as number | undefined,
  eventId: undefined as number | undefined,
})

// === Form rules ===
const rules = {
  athleteId: [{ required: true, message: '请选择运动员', trigger: 'change' }],
  eventId: [{ required: true, message: '请选择项目', trigger: 'change' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '运动员', dataIndex: 'athleteName', key: 'athleteName' },
  { title: '学号', dataIndex: 'studentNo', key: 'studentNo' },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '项目', dataIndex: 'eventName', key: 'eventName' },
  { title: '比赛场次', dataIndex: 'competitionId', key: 'competitionId' },
  { title: '道次', dataIndex: 'laneNo', key: 'laneNo' },
  { title: '号码牌', dataIndex: 'bibNumber', key: 'bibNumber' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '报名时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action', width: 150 },
]

// === Status helpers（内联 a-tag 配色与文案） ===
function getStatusColor(status: number): string {
  switch (status) {
    case 0:
      return 'blue' // 已报名
    case 1:
      return 'green' // 检录通过
    case 2:
      return 'default' // 已参赛
    case 3:
      return 'orange' // 弃权
    case 4:
      return 'red' // 取消资格
    default:
      return 'default'
  }
}

function getStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return '已报名'
    case 1:
      return '检录通过'
    case 2:
      return '已参赛'
    case 3:
      return '弃权'
    case 4:
      return '取消资格'
    default:
      return '未知'
  }
}

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    const result = await getParticipationListApi({
      current: paginationConfig.current,
      size: paginationConfig.pageSize,
      ...filters,
    })
    participationList.value = result.records
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
  modalTitle.value = '新增报名'
  Object.assign(formState, {
    athleteId: undefined,
    eventId: undefined,
  })
  modalVisible.value = true
}

// 运动员下拉搜索过滤（按姓名/学号）
function filterAthleteOption(input: string, option: { label?: string }) {
  const label = option?.label ?? ''
  return label.toLowerCase().includes(input.toLowerCase())
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    submitLoading.value = true
    const dto: ParticipationCreateDTO = {
      athleteId: formState.athleteId!,
      eventId: formState.eventId!,
    }
    await createParticipationApi(dto)
    message.success('报名成功')
    modalVisible.value = false
    await loadList()
  } finally {
    submitLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
}

// === Cancel handler（取消报名） ===
function handleCancel(record: ParticipationVO) {
  Modal.confirm({
    title: '确认取消',
    content: `确定要取消「${record.athleteName}」的「${record.eventName}」报名吗？`,
    okType: 'danger',
    okText: '取消报名',
    cancelText: '关闭',
    onOk: async () => {
      await cancelParticipationApi(record.id)
      message.success('已取消报名')
      await loadList()
    },
  })
}

// === CheckIn handler（检录） ===
function handleCheckIn(record: ParticipationVO) {
  Modal.confirm({
    title: '确认检录',
    content: `确定要将「${record.athleteName}」检录通过吗？`,
    okText: '检录',
    cancelText: '关闭',
    onOk: async () => {
      await checkInParticipationApi(record.id)
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
  getEventListApi().then((list) => {
    eventOptions.value = list
    individualEventOptions.value = list.filter((e) => e.type === 1)
  })
  // 运动员下拉：一次性拉取较大列表用于表单选择
  getAthleteListApi({ current: 1, size: 200 }).then((res) => {
    athleteOptions.value = res.records
  })
})
</script>

<style scoped lang="less">
.participation-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
  .page-header {
    margin-bottom: @space-md;
  }
}
</style>
