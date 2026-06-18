<template>
  <div class="event-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-select
          v-model:value="queryParams.type"
          placeholder="项目类型"
          allowClear
          style="width: 140px"
          @change="fetchData"
        >
          <a-select-option :value="1">个人项目</a-select-option>
          <a-select-option :value="2">集体项目</a-select-option>
        </a-select>
        <a-select
          v-model:value="queryParams.category"
          placeholder="项目类别"
          allowClear
          style="width: 140px"
          @change="fetchData"
        >
          <a-select-option :value="1">径赛</a-select-option>
          <a-select-option :value="2">田赛</a-select-option>
        </a-select>
        <a-select
          v-model:value="queryParams.gender"
          placeholder="性别"
          allowClear
          style="width: 140px"
          @change="fetchData"
        >
          <a-select-option :value="0">女子</a-select-option>
          <a-select-option :value="1">男子</a-select-option>
          <a-select-option :value="2">混合</a-select-option>
        </a-select>
        <a-select
          v-model:value="queryParams.status"
          placeholder="状态"
          allowClear
          style="width: 140px"
          @change="fetchData"
        >
          <a-select-option :value="0">停用</a-select-option>
          <a-select-option :value="1">启用</a-select-option>
        </a-select>
        <a-button @click="handleReset">重置</a-button>
        <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
          新增比赛项目
        </a-button>
      </a-space>
    </div>

    <!-- Table -->
    <a-table
      :columns="columns"
      :data-source="dataList"
      :loading="loading"
      row-key="id"
      :pagination="{ pageSize: 15 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <StatusTag :status="(record as EventVO).type" type="eventType" />
        </template>
        <template v-if="column.key === 'category'">
          <StatusTag :status="(record as EventVO).category" type="eventCategory" />
        </template>
        <template v-if="column.key === 'gender'">
          <StatusTag :status="(record as EventVO).gender" type="gender" />
        </template>
        <template v-if="column.key === 'status'">
          <StatusTag :status="(record as EventVO).status" type="enable" />
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              type="link"
              size="small"
              @click="handleViewRecords(record as EventVO)"
            >
              历史记录
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              size="small"
              @click="handleEdit(record as EventVO)"
            >
              编辑
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
              @click="handleDelete(record as EventVO)"
            >
              删除
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- Add/Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="modalTitle"
      :confirm-loading="modalLoading"
      width="600px"
      @ok="handleSubmit"
      @cancel="handleModalClose"
    >
      <a-form
        ref="formRef"
        :model="form"
        :rules="rules"
        layout="vertical"
        style="margin-top: 16px"
      >
        <a-form-item label="项目名称" name="name">
          <a-input v-model:value="form.name" placeholder="请输入项目名称" :maxlength="100" />
        </a-form-item>
        <a-form-item label="项目代码" name="code">
          <a-input v-model:value="form.code" placeholder="请输入项目代码" :maxlength="50" />
        </a-form-item>
        <a-form-item label="项目类型" name="type">
          <a-select v-model:value="form.type" placeholder="请选择">
            <a-select-option :value="1">个人项目</a-select-option>
            <a-select-option :value="2">集体项目</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="项目类别" name="category">
          <a-select v-model:value="form.category" placeholder="请选择">
            <a-select-option :value="1">径赛</a-select-option>
            <a-select-option :value="2">田赛</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="性别限制" name="gender">
          <a-select v-model:value="form.gender" placeholder="请选择">
            <a-select-option :value="0">女子</a-select-option>
            <a-select-option :value="1">男子</a-select-option>
            <a-select-option :value="2">混合</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="计量单位" name="unit">
          <a-input v-model:value="form.unit" placeholder="如：秒、米、分" :maxlength="20" />
        </a-form-item>
        <a-form-item v-if="isTeamEvent" label="最大参赛人数" name="maxParticipants">
          <a-input-number v-model:value="form.maxParticipants" :min="2" style="width: 100%" />
        </a-form-item>
        <a-form-item label="个人限报项目数" name="maxIndividualEvents">
          <a-input-number v-model:value="form.maxIndividualEvents" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item label="项目描述" name="description">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="请输入项目描述（可选）" :maxlength="500" />
        </a-form-item>
        <a-form-item v-if="isEdit" label="状态" name="status">
          <a-select v-model:value="form.status">
            <a-select-option :value="0">停用</a-select-option>
            <a-select-option :value="1">启用</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- History Records Modal -->
    <a-modal
      v-model:open="recordsModalVisible"
      :title="`历史记录 - ${recordsEventName}`"
      width="800px"
      :footer="null"
    >
      <div class="filter-bar" style="margin-bottom: 16px">
        <a-select
          v-model:value="recordsRecordType"
          placeholder="记录类型"
          allowClear
          style="width: 160px"
          @change="fetchRecords"
        >
          <a-select-option :value="1">校记录</a-select-option>
          <a-select-option :value="2">市记录</a-select-option>
          <a-select-option :value="3">省记录</a-select-option>
        </a-select>
      </div>
      <a-table
        :columns="recordColumns"
        :data-source="recordsList"
        :loading="recordsLoading"
        row-key="id"
        size="small"
        :pagination="{ pageSize: 10 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'recordType'">
            <StatusTag :status="(record as RecordVO).recordType" type="recordType" />
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import StatusTag from '@/components/StatusTag/index.vue'
import {
  getEventListApi,
  getEventByIdApi,
  createEventApi,
  updateEventApi,
  deleteEventApi,
  getEventRecordsApi,
  type EventVO,
  type EventCreateDTO,
  type EventUpdateDTO,
  type EventQueryParams,
  type RecordVO,
} from '@/api/event'

// === Store ===
const userStore = useUserStore()

// === Data state ===
const loading = ref(false)
const dataList = ref<EventVO[]>([])

// === Filter state ===
const queryParams = reactive<EventQueryParams>({
  type: undefined,
  category: undefined,
  gender: undefined,
  status: undefined,
})

// === Modal state (Add/Edit) ===
const modalVisible = ref(false)
const modalTitle = ref('')
const modalLoading = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

// === Records Modal state ===
const recordsModalVisible = ref(false)
const recordsLoading = ref(false)
const recordsList = ref<RecordVO[]>([])
const recordsEventName = ref('')
const recordsRecordType = ref<number | undefined>(undefined)
const currentRecordId = ref<number | null>(null)

// === Form reactive ===
const form = reactive<{
  name: string
  code: string
  type: number | undefined
  category: number | undefined
  gender: number | undefined
  unit: string
  maxParticipants: number | undefined
  maxIndividualEvents: number | undefined
  description: string
  status: number | undefined
}>({
  name: '',
  code: '',
  type: undefined,
  category: undefined,
  gender: undefined,
  unit: '',
  maxParticipants: undefined,
  maxIndividualEvents: undefined,
  description: '',
  status: undefined,
})

// 个人项目(type=1)无最大参赛人数；集体项目(type=2)才有
const isTeamEvent = computed(() => form.type === 2)

// type 切换为个人项目时，自动清空 maxParticipants（呼应后端 Logic 规则）
watch(isTeamEvent, (team) => {
  if (!team) {
    form.maxParticipants = undefined
  }
})

// === Form rules ===
const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入项目代码', trigger: 'blur' }],
  type: [{ required: true, message: '请选择项目类型', trigger: 'change' }],
  category: [{ required: true, message: '请选择项目类别', trigger: 'change' }],
  gender: [{ required: true, message: '请选择性别限制', trigger: 'change' }],
  unit: [{ required: true, message: '请输入计量单位', trigger: 'blur' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '项目名称', dataIndex: 'name', key: 'name' },
  { title: '项目代码', dataIndex: 'code', key: 'code', width: 120 },
  { title: '类型', key: 'type', width: 100 },
  { title: '类别', key: 'category', width: 100 },
  { title: '性别', key: 'gender', width: 90 },
  { title: '计量单位', dataIndex: 'unit', key: 'unit', width: 100 },
  { title: '个人限报', dataIndex: 'maxIndividualEvents', key: 'maxIndividualEvents', width: 100 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 240, fixed: 'right' },
]

// === Records table columns ===
const recordColumns: TableColumnsType = [
  { title: '成绩', dataIndex: 'achievement', key: 'achievement' },
  { title: '记录类型', key: 'recordType', width: 100 },
  { title: '保持者', dataIndex: 'athleteName', key: 'athleteName' },
  { title: '达成日期', dataIndex: 'achievementDate', key: 'achievementDate', width: 130 },
  { title: '赛事', dataIndex: 'competitionName', key: 'competitionName' },
]

// === Data loading ===
async function fetchData() {
  loading.value = true
  try {
    dataList.value = await getEventListApi({ ...queryParams })
  } finally {
    loading.value = false
  }
}

// === Filter reset ===
function handleReset() {
  Object.assign(queryParams, {
    type: undefined,
    category: undefined,
    gender: undefined,
    status: undefined,
  })
  fetchData()
}

// === Add handler ===
function handleAdd() {
  isEdit.value = false
  editingId.value = null
  modalTitle.value = '新增比赛项目'
  Object.assign(form, {
    name: '',
    code: '',
    type: undefined,
    category: undefined,
    gender: undefined,
    unit: '',
    maxParticipants: undefined,
    maxIndividualEvents: undefined,
    description: '',
    status: undefined, // 新增不传 status，后端 POST 强制默认 1
  })
  modalVisible.value = true
}

// === Edit handler ===
async function handleEdit(record: EventVO) {
  isEdit.value = true
  editingId.value = record.id
  modalTitle.value = '编辑比赛项目'
  try {
    const detail = await getEventByIdApi(record.id)
    Object.assign(form, {
      name: detail.name,
      code: detail.code,
      type: detail.type,
      category: detail.category,
      gender: detail.gender,
      unit: detail.unit,
      maxParticipants: detail.maxParticipants ?? undefined,
      maxIndividualEvents: detail.maxIndividualEvents,
      description: detail.description || '',
      status: detail.status, // 编辑模式允许修改 status
    })
  } catch {
    // 拦截器统一处理，降级使用列表行数据
    Object.assign(form, {
      name: record.name,
      code: record.code,
      type: record.type,
      category: record.category,
      gender: record.gender,
      unit: record.unit,
      maxParticipants: record.maxParticipants ?? undefined,
      maxIndividualEvents: record.maxIndividualEvents,
      description: record.description || '',
      status: record.status,
    })
  }
  modalVisible.value = true
}

// === Submit handler ===
async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    modalLoading.value = true
    if (isEdit.value && editingId.value) {
      const dto: EventUpdateDTO = {
        name: form.name,
        code: form.code,
        type: form.type,
        category: form.category,
        gender: form.gender,
        unit: form.unit,
        // 集体项目传值，个人项目传 null（与后端规则一致）
        maxParticipants: isTeamEvent.value ? form.maxParticipants : null,
        maxIndividualEvents: form.maxIndividualEvents,
        description: form.description || undefined,
        status: form.status,
      }
      await updateEventApi(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: EventCreateDTO = {
        name: form.name,
        code: form.code,
        type: form.type!,
        category: form.category!,
        gender: form.gender!,
        unit: form.unit,
        maxParticipants: isTeamEvent.value ? form.maxParticipants : undefined,
        maxIndividualEvents: form.maxIndividualEvents,
        description: form.description || undefined,
        // 不传 status —— 后端 POST 拒绝该字段，强制默认 1
      }
      await createEventApi(dto)
      message.success('创建成功')
    }
    modalVisible.value = false
    await fetchData()
  } finally {
    modalLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
}

// === Delete handler ===
function handleDelete(record: EventVO) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除比赛项目「${record.name}」吗？`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      await deleteEventApi(record.id)
      message.success('删除成功')
      await fetchData()
    },
  })
}

// === Records handler ===
async function fetchRecords() {
  if (currentRecordId.value === null) return
  recordsLoading.value = true
  try {
    recordsList.value = await getEventRecordsApi(
      currentRecordId.value,
      recordsRecordType.value,
    )
  } finally {
    recordsLoading.value = false
  }
}

function handleViewRecords(record: EventVO) {
  recordsEventName.value = record.name
  currentRecordId.value = record.id
  recordsRecordType.value = undefined
  recordsModalVisible.value = true
  fetchRecords()
}

// === Lifecycle ===
onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="less">
.event-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
}
</style>
