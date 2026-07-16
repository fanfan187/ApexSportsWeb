<template>
  <div class="record-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-input-number
          v-model:value="filters.eventId"
          placeholder="项目ID"
          :min="1"
          allow-clear
          style="width: 160px"
        />
        <a-select
          v-model:value="filters.recordType"
          :options="RECORD_TYPE_OPTIONS"
          placeholder="记录类型"
          allow-clear
          style="width: 140px"
        />
        <a-select
          v-model:value="filters.status"
          :options="STATUS_OPTIONS"
          placeholder="状态"
          allow-clear
          style="width: 120px"
        />
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Header with Add button (admin only) -->
    <div class="page-header">
      <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
        新增记录
      </a-button>
    </div>

    <!-- Table (no pagination, API returns full list) -->
    <a-table
      :columns="columns"
      :data-source="recordList"
      :loading="loading"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <!-- eventName column (nullable display) -->
        <template v-if="column.key === 'eventName'">
          {{ (record as RecordListVO).eventName || '-' }}
        </template>
        <!-- recordType column -->
        <template v-if="column.key === 'recordType'">
          <StatusTag :status="(record as RecordListVO).recordType" type="recordType" />
        </template>
        <!-- athleteName column -->
        <template v-if="column.key === 'athleteName'">
          {{ (record as RecordListVO).athleteName || '-' }}
        </template>
        <!-- collegeName column -->
        <template v-if="column.key === 'collegeName'">
          {{ (record as RecordListVO).collegeName || '-' }}
        </template>
        <!-- competitionName column (nullable display) -->
        <template v-if="column.key === 'competitionName'">
          {{ (record as RecordListVO).competitionName || '-' }}
        </template>
        <!-- status column -->
        <template v-if="column.key === 'status'">
          <StatusTag :status="(record as RecordListVO).status" type="record" />
        </template>
        <!-- recordDate column -->
        <template v-if="column.key === 'recordDate'">
          {{
            (record as RecordListVO).recordDate
              ? dayjs((record as RecordListVO).recordDate).format('YYYY-MM-DD')
              : '-'
          }}
        </template>
        <!-- Action column (admin only) -->
        <template v-if="column.key === 'action'">
          <a-space v-if="userStore.isAdmin">
            <a-button
              type="link"
              size="small"
              @click="handleEdit(record as RecordListVO)"
            >
              编辑
            </a-button>
            <a-popconfirm
              title="确定要作废此记录吗？"
              ok-text="作废"
              cancel-text="取消"
              ok-type="danger"
              @confirm="handleInvalidate(record as RecordListVO)"
            >
              <a-button type="link" danger size="small">作废</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- Add/Edit Modal -->
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
        <a-form-item label="项目ID" name="eventId">
          <a-input-number
            v-model:value="formState.eventId"
            :min="1"
            placeholder="请输入项目ID"
            :disabled="isEdit"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="记录类型" name="recordType">
          <a-select
            v-model:value="formState.recordType"
            :options="RECORD_TYPE_OPTIONS"
            placeholder="请选择记录类型"
          />
        </a-form-item>
        <a-form-item label="运动员ID" name="athleteId">
          <a-input-number
            v-model:value="formState.athleteId"
            :min="1"
            placeholder="个人记录请输入运动员ID"
            :disabled="isEdit"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="运动员姓名" name="athleteName">
          <a-input
            v-model:value="formState.athleteName"
            placeholder="请输入运动员姓名"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item label="学院ID" name="collegeId">
          <a-input-number
            v-model:value="formState.collegeId"
            :min="1"
            placeholder="团体记录请输入学院ID"
            :disabled="isEdit"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="学院名称" name="collegeName">
          <a-input
            v-model:value="formState.collegeName"
            placeholder="请输入学院名称"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item label="成绩" name="score">
          <a-input-number
            v-model:value="formState.score"
            :step="0.01"
            placeholder="请输入成绩数值"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="成绩显示" name="scoreDisplay">
          <a-input
            v-model:value="formState.scoreDisplay"
            placeholder="请输入成绩显示文本"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item label="创纪录日期" name="recordDate">
          <a-date-picker
            v-model:value="formState.recordDate"
            value-format="YYYY-MM-DD"
            placeholder="请选择创纪录日期"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="比赛名称" name="competitionName">
          <a-input
            v-model:value="formState.competitionName"
            placeholder="请输入比赛名称（可选）"
            :maxlength="100"
          />
        </a-form-item>
        <!-- Status field only in edit mode -->
        <a-form-item v-if="isEdit" label="状态" name="status">
          <a-select
            v-model:value="formState.status"
            :options="STATUS_OPTIONS"
            placeholder="请选择状态"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import StatusTag from '@/components/StatusTag/index.vue'
import {
  getRecordListApi,
  getRecordByIdApi,
  createRecordApi,
  updateRecordApi,
  type RecordListVO,
  type RecordCreateDTO,
  type RecordUpdateDTO,
} from '@/api/record'
import { RECORD_TYPE_OPTIONS, STATUS_OPTIONS } from './constants'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const recordList = ref<RecordListVO[]>([])
const loading = ref(false)

// === Filter bar state ===
const filters = reactive({
  eventId: undefined as number | undefined,
  recordType: undefined as number | undefined,
  status: undefined as number | undefined,
})

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// === Form state ===
const formState = reactive({
  eventId: undefined as number | undefined,
  recordType: undefined as number | undefined,
  athleteId: undefined as number | undefined,
  athleteName: '',
  collegeId: undefined as number | undefined,
  collegeName: '',
  score: undefined as number | undefined,
  scoreDisplay: '',
  recordDate: undefined as string | undefined,
  competitionName: '',
  status: undefined as number | undefined,
})

// === Form rules ===
const rules = {
  eventId: [{ required: true, message: '请输入项目ID', trigger: 'blur' }],
  recordType: [{ required: true, message: '请选择记录类型', trigger: 'change' }],
  score: [{ required: true, message: '请输入成绩数值', trigger: 'blur' }],
  scoreDisplay: [{ required: true, message: '请输入成绩显示文本', trigger: 'blur' }],
  recordDate: [{ required: true, message: '请选择创纪录日期', trigger: 'change' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '项目名称', dataIndex: 'eventName', key: 'eventName' },
  { title: '记录类型', dataIndex: 'recordType', key: 'recordType', width: 100 },
  { title: '运动员', dataIndex: 'athleteName', key: 'athleteName', width: 100 },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName', width: 120 },
  { title: '成绩显示', dataIndex: 'scoreDisplay', key: 'scoreDisplay', width: 110 },
  { title: '创纪录日期', dataIndex: 'recordDate', key: 'recordDate', width: 120 },
  { title: '比赛名称', dataIndex: 'competitionName', key: 'competitionName' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 140, fixed: 'right' },
]

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    recordList.value = await getRecordListApi(filters.eventId, filters.recordType, filters.status)
  } catch {
    message.error('加载记录列表失败')
  } finally {
    loading.value = false
  }
}

// === Filter handlers ===
function handleSearch() {
  loadList()
}

function handleReset() {
  Object.assign(filters, { eventId: undefined, recordType: undefined, status: undefined })
  loadList()
}

// === Add/Edit handlers ===
function resetForm() {
  Object.assign(formState, {
    eventId: undefined,
    recordType: undefined,
    athleteId: undefined,
    athleteName: '',
    collegeId: undefined,
    collegeName: '',
    score: undefined,
    scoreDisplay: '',
    recordDate: undefined,
    competitionName: '',
    status: undefined,
  })
}

function handleAdd() {
  isEdit.value = false
  modalTitle.value = '新增记录'
  editingId.value = null
  resetForm()
  modalVisible.value = true
}

async function handleEdit(record: RecordListVO) {
  isEdit.value = true
  modalTitle.value = '编辑记录'
  editingId.value = record.id
  resetForm()
  // Fetch the latest detail to ensure complete fields (eventId/athleteId/collegeId are detail-only)
  try {
    const detail = await getRecordByIdApi(record.id)
    Object.assign(formState, {
      eventId: detail.eventId,
      recordType: detail.recordType,
      athleteId: detail.athleteId,
      athleteName: detail.athleteName,
      collegeId: detail.collegeId,
      collegeName: detail.collegeName,
      score: detail.score,
      scoreDisplay: detail.scoreDisplay,
      recordDate: detail.recordDate,
      competitionName: detail.competitionName,
      status: detail.status,
    })
  } catch {
    message.error('加载记录详情失败')
    return
  }
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
  } catch {
    // validation error surfaced by form
    return
  }
  submitLoading.value = true
  try {
    if (isEdit.value && editingId.value) {
      const dto: RecordUpdateDTO = {
        recordType: formState.recordType,
        athleteName: formState.athleteName || undefined,
        collegeName: formState.collegeName || undefined,
        score: formState.score,
        scoreDisplay: formState.scoreDisplay,
        recordDate: formState.recordDate,
        competitionName: formState.competitionName || undefined,
        status: formState.status,
      }
      await updateRecordApi(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: RecordCreateDTO = {
        eventId: formState.eventId!,
        recordType: formState.recordType!,
        athleteId: formState.athleteId,
        collegeId: formState.collegeId,
        athleteName: formState.athleteName || undefined,
        collegeName: formState.collegeName || undefined,
        score: formState.score!,
        scoreDisplay: formState.scoreDisplay,
        recordDate: formState.recordDate!,
        competitionName: formState.competitionName || undefined,
      }
      await createRecordApi(dto)
      message.success('创建成功')
    }
    modalVisible.value = false
    await loadList()
  } catch {
    message.error(isEdit.value ? '修改失败' : '创建失败')
  } finally {
    submitLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
}

// === Invalidate handler (soft-delete via PUT status=0, no DELETE endpoint) ===
async function handleInvalidate(record: RecordListVO) {
  try {
    await updateRecordApi(record.id, { status: 0 })
    message.success('作废成功')
    await loadList()
  } catch {
    message.error('作废失败')
  }
}

// === Lifecycle ===
onMounted(() => {
  loadList()
})
</script>

<style scoped lang="less">
.record-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
  .page-header {
    margin-bottom: @space-md;
  }
}
</style>
