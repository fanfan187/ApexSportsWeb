<template>
  <div class="venue-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-select
          v-model:value="filters.type"
          placeholder="场地类型"
          allowClear
          style="width: 160px"
        >
          <a-select-option :value="1">径赛场地</a-select-option>
          <a-select-option :value="2">田赛场地</a-select-option>
          <a-select-option :value="3">综合场地</a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allowClear
          style="width: 120px"
        >
          <a-select-option :value="1">可用</a-select-option>
          <a-select-option :value="0">不可用</a-select-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Header with Add button (admin only) -->
    <div class="page-header">
      <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
        新增场地
      </a-button>
    </div>

    <!-- Table (no pagination, API returns full list) -->
    <a-table
      :columns="columns"
      :data-source="venueList"
      :loading="loading"
      :expandable="expandableConfig"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <!-- Type column -->
        <template v-if="column.key === 'type'">
          <StatusTag :status="(record as VenueVO).type" type="venueType" />
        </template>
        <!-- Status column -->
        <template v-if="column.key === 'status'">
          <StatusTag :status="(record as VenueVO).status" type="enable" />
        </template>
        <!-- Capacity column -->
        <template v-if="column.key === 'capacity'">
          {{ (record as VenueVO).capacity ?? '-' }}
        </template>
        <!-- Location column -->
        <template v-if="column.key === 'location'">
          {{ (record as VenueVO).location || '-' }}
        </template>
        <!-- CreatedAt column -->
        <template v-if="column.key === 'createdAt'">
          {{
            (record as VenueVO).createdAt
              ? dayjs((record as VenueVO).createdAt).format('YYYY-MM-DD HH:mm:ss')
              : '-'
          }}
        </template>
        <!-- Action column -->
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              size="small"
              @click="handleEdit(record as VenueVO)"
            >
              编辑
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
              @click="handleDelete(record as VenueVO)"
            >
              删除
            </a-button>
          </a-space>
        </template>
      </template>

      <!-- Expanded row: venue schedule occupancy -->
      <template #expandedRowRender="{ record }">
        <div class="schedule-panel">
          <div class="schedule-toolbar">
            <span class="schedule-title">
              场地「{{ (record as VenueVO).name }}」赛程占用
            </span>
            <a-date-picker
              :value="scheduleDateFilter[(record as VenueVO).id]"
              placeholder="按日期筛选"
              allowClear
              style="width: 180px"
              @change="(_d: unknown, dateStr: string) => handleScheduleDateChange((record as VenueVO).id, dateStr)"
            />
          </div>
          <a-table
            :columns="scheduleColumns"
            :data-source="scheduleCache[(record as VenueVO).id] || []"
            :loading="!!scheduleLoading[(record as VenueVO).id]"
            row-key="id"
            :pagination="false"
            size="small"
          >
            <template #bodyCell="{ column: subCol, record: subRecord }">
              <template v-if="subCol.key === 'status'">
                <StatusTag
                  :status="(subRecord as VenueScheduleVO).status"
                  type="competition"
                />
              </template>
              <template v-if="subCol.key === 'startTime'">
                {{ formatTime((subRecord as VenueScheduleVO).startTime) }}
              </template>
              <template v-if="subCol.key === 'endTime'">
                {{ formatTime((subRecord as VenueScheduleVO).endTime) }}
              </template>
            </template>
          </a-table>
        </div>
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
        <a-form-item label="场地名称" name="name">
          <a-input
            v-model:value="formState.name"
            placeholder="请输入场地名称"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item label="场地代码" name="code">
          <a-input
            v-model:value="formState.code"
            placeholder="请输入场地代码"
            :maxlength="30"
          />
        </a-form-item>
        <a-form-item label="场地类型" name="type">
          <a-select v-model:value="formState.type" placeholder="请选择场地类型">
            <a-select-option :value="1">径赛场地</a-select-option>
            <a-select-option :value="2">田赛场地</a-select-option>
            <a-select-option :value="3">综合场地</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="位置" name="location">
          <a-input
            v-model:value="formState.location"
            placeholder="请输入位置（可选）"
            :maxlength="100"
          />
        </a-form-item>
        <a-form-item label="容量" name="capacity">
          <a-input-number
            v-model:value="formState.capacity"
            :min="0"
            placeholder="请输入容量（可选）"
            style="width: 100%"
          />
        </a-form-item>
        <!-- Status field only in edit mode -->
        <a-form-item v-if="isEdit" label="状态" name="status">
          <a-select v-model:value="formState.status" placeholder="请选择状态">
            <a-select-option :value="1">可用</a-select-option>
            <a-select-option :value="0">不可用</a-select-option>
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
import type { Dayjs } from 'dayjs'
import { useUserStore } from '@/stores/user'
import StatusTag from '@/components/StatusTag/index.vue'
import {
  getVenueListApi,
  getVenueByIdApi,
  createVenueApi,
  updateVenueApi,
  deleteVenueApi,
  getVenueScheduleApi,
  type VenueVO,
  type VenueCreateDTO,
  type VenueUpdateDTO,
  type VenueScheduleVO,
} from '@/api/venue'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const venueList = ref<VenueVO[]>([])
const loading = ref(false)

// === Filter bar state ===
const filters = reactive({
  type: undefined as number | undefined,
  status: undefined as number | undefined,
})

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// === Form state (status only used in edit mode) ===
const formState = reactive({
  name: '',
  code: '',
  type: undefined as number | undefined,
  location: '',
  capacity: undefined as number | undefined,
  status: undefined as number | undefined,
})

// === Form rules ===
const rules = {
  name: [{ required: true, message: '请输入场地名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入场地代码', trigger: 'blur' }],
  type: [{ required: true, message: '请选择场地类型', trigger: 'change' }],
}

// === Expandable rows state ===
const expandedRowKeys = ref<number[]>([])
const scheduleCache = ref<Record<number, VenueScheduleVO[]>>({})
const scheduleLoading = ref<Record<number, boolean>>({})
const scheduleDateFilter = ref<Record<number, Dayjs | undefined>>({})

// === Table columns ===
const columns: TableColumnsType = [
  { title: '场地代码', dataIndex: 'code', key: 'code', width: 120 },
  { title: '场地名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '位置', dataIndex: 'location', key: 'location' },
  { title: '容量', dataIndex: 'capacity', key: 'capacity', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

const scheduleColumns: TableColumnsType = [
  { title: '项目名称', dataIndex: 'eventName', key: 'eventName' },
  { title: '开始时间', dataIndex: 'startTime', key: 'startTime', width: 180 },
  { title: '结束时间', dataIndex: 'endTime', key: 'endTime', width: 180 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
]

// === Expandable config ===
const expandableConfig = {
  expandedRowKeys,
  onExpand: handleExpand,
  onExpandedRowsChange: (rows: (string | number)[]) => {
    expandedRowKeys.value = rows as number[]
  },
}

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    venueList.value = await getVenueListApi(filters.type, filters.status)
  } catch {
    message.error('加载场地列表失败')
  } finally {
    loading.value = false
  }
}

// === Filter handlers ===
function handleSearch() {
  loadList()
}

function handleReset() {
  Object.assign(filters, { type: undefined, status: undefined })
  loadList()
}

// === Add/Edit handlers ===
function handleAdd() {
  isEdit.value = false
  modalTitle.value = '新增场地'
  editingId.value = null
  Object.assign(formState, {
    name: '',
    code: '',
    type: undefined,
    location: '',
    capacity: undefined,
    status: undefined,
  })
  modalVisible.value = true
}

async function handleEdit(record: VenueVO) {
  isEdit.value = true
  modalTitle.value = '编辑场地'
  editingId.value = record.id
  // Fetch the latest detail to ensure complete fields
  try {
    const detail = await getVenueByIdApi(record.id)
    Object.assign(formState, {
      name: detail.name,
      code: detail.code,
      type: detail.type,
      location: detail.location || '',
      capacity: detail.capacity,
      status: detail.status,
    })
  } catch {
    // Fallback to row data if detail fetch fails
    Object.assign(formState, {
      name: record.name,
      code: record.code,
      type: record.type,
      location: record.location || '',
      capacity: record.capacity,
      status: record.status,
    })
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
      const dto: VenueUpdateDTO = {
        name: formState.name,
        code: formState.code,
        type: formState.type,
        location: formState.location || undefined,
        capacity: formState.capacity,
        status: formState.status,
      }
      await updateVenueApi(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: VenueCreateDTO = {
        name: formState.name,
        code: formState.code,
        type: formState.type!,
        location: formState.location || undefined,
        capacity: formState.capacity,
      }
      await createVenueApi(dto)
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

// === Delete handler ===
function handleDelete(record: VenueVO) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除场地「${record.name}」吗？`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteVenueApi(record.id)
        message.success('删除成功')
        await loadList()
      } catch {
        message.error('删除失败')
      }
    },
  })
}

// === Expandable schedule ===
async function handleExpand(expanded: boolean, record: VenueVO) {
  if (expanded) {
    // Reset date filter when freshly expanding
    scheduleDateFilter.value[record.id] = undefined
    await loadSchedule(record.id)
  }
}

async function loadSchedule(venueId: number, date?: string) {
  scheduleLoading.value[venueId] = true
  try {
    scheduleCache.value[venueId] = await getVenueScheduleApi(venueId, date)
  } catch {
    scheduleCache.value[venueId] = []
    message.error('加载赛程占用失败')
  } finally {
    scheduleLoading.value[venueId] = false
  }
}

function handleScheduleDateChange(venueId: number, dateStr: string) {
  if (dateStr) {
    scheduleDateFilter.value[venueId] = dayjs(dateStr)
    loadSchedule(venueId, dateStr)
  } else {
    scheduleDateFilter.value[venueId] = undefined
    loadSchedule(venueId, undefined)
  }
}

// === Helpers ===
function formatTime(value: string): string {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
}

// === Lifecycle ===
onMounted(() => {
  loadList()
})
</script>

<style scoped lang="less">
.venue-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
  .page-header {
    margin-bottom: @space-md;
  }
  .schedule-panel {
    padding: 8px 16px;

    .schedule-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: @space-sm;

      .schedule-title {
        font-weight: 500;
        color: @text-color;
      }
    }
  }
}
</style>
