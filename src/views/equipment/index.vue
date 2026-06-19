<template>
  <div class="equipment-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-select
          v-model:value="filters.type"
          placeholder="器材类型"
          allowClear
          style="width: 160px"
        >
          <a-select-option v-for="t in EQUIPMENT_TYPES" :key="t" :value="t">{{ t }}</a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allowClear
          style="width: 120px"
        >
          <a-select-option :value="1">可用</a-select-option>
          <a-select-option :value="0">停用</a-select-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Header with Add button (admin only) -->
    <div class="page-header">
      <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
        新增器材
      </a-button>
    </div>

    <!-- Table (no pagination, API returns full list) -->
    <a-table
      :columns="columns"
      :data-source="equipmentList"
      :loading="loading"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <!-- Type column (nullable) -->
        <template v-if="column.key === 'type'">
          {{ (record as EquipmentVO).type || '-' }}
        </template>
        <!-- Status column -->
        <template v-if="column.key === 'status'">
          <StatusTag :status="(record as EquipmentVO).status" type="enable" />
        </template>
        <!-- CreatedAt column -->
        <template v-if="column.key === 'createdAt'">
          {{
            (record as EquipmentVO).createdAt
              ? dayjs((record as EquipmentVO).createdAt).format('YYYY-MM-DD HH:mm:ss')
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
              @click="handleEdit(record as EquipmentVO)"
            >
              编辑
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
              @click="handleDelete(record as EquipmentVO)"
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
        <a-form-item label="器材名称" name="name">
          <a-input
            v-model:value="formState.name"
            placeholder="请输入器材名称"
            :maxlength="100"
          />
        </a-form-item>
        <a-form-item label="器材代码" name="code">
          <a-input
            v-model:value="formState.code"
            placeholder="请输入器材代码"
            :maxlength="20"
          />
        </a-form-item>
        <a-form-item label="器材类型" name="type">
          <a-auto-complete
            v-model:value="formState.type"
            :options="typeOptions"
            placeholder="请选择或输入器材类型"
            :filter-option="filterOption"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="计量单位" name="unit">
          <a-auto-complete
            v-model:value="formState.unit"
            :options="unitOptions"
            placeholder="请选择或输入计量单位"
            :filter-option="filterOption"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="总数量" name="totalQuantity">
          <a-input-number
            v-model:value="formState.totalQuantity"
            :min="0"
            :max="100000"
            placeholder="请输入总数量"
            style="width: 100%"
          />
        </a-form-item>
        <!-- Status field only in edit mode -->
        <a-form-item v-if="isEdit" label="状态" name="status">
          <a-select v-model:value="formState.status" placeholder="请选择状态">
            <a-select-option :value="1">可用</a-select-option>
            <a-select-option :value="0">停用</a-select-option>
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
import StatusTag from '@/components/StatusTag/index.vue'
import {
  getEquipmentListApi,
  getEquipmentByIdApi,
  createEquipmentApi,
  updateEquipmentApi,
  deleteEquipmentApi,
  type EquipmentVO,
  type EquipmentCreateDTO,
  type EquipmentUpdateDTO,
} from '@/api/equipment'
import { EQUIPMENT_TYPES, EQUIPMENT_UNITS } from './constants'

// === Store ===
const userStore = useUserStore()

// === a-auto-complete options (v4: options = { value: string }[]) ===
const typeOptions = EQUIPMENT_TYPES.map((t) => ({ value: t }))
const unitOptions = EQUIPMENT_UNITS.map((u) => ({ value: u }))
const filterOption = (input: string, option: { value: string }) =>
  option.value.toLowerCase().includes(input.toLowerCase())

// === Table state ===
const equipmentList = ref<EquipmentVO[]>([])
const loading = ref(false)

// === Filter bar state ===
const filters = reactive({
  type: undefined as string | undefined,
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
  type: undefined as string | undefined,
  unit: undefined as string | undefined,
  totalQuantity: undefined as number | undefined,
  status: undefined as number | undefined,
})

// === Form rules ===
const rules = {
  name: [{ required: true, message: '请输入器材名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入器材代码', trigger: 'blur' }],
  unit: [{ required: true, message: '请选择或输入计量单位', trigger: 'change' }],
  totalQuantity: [{ required: true, message: '请输入总数量', trigger: 'blur' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '器材代码', dataIndex: 'code', key: 'code', width: 120 },
  { title: '器材名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '计量单位', dataIndex: 'unit', key: 'unit', width: 100 },
  { title: '总数量', dataIndex: 'totalQuantity', key: 'totalQuantity', width: 100 },
  { title: '可用数量', dataIndex: 'availableQuantity', key: 'availableQuantity', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    equipmentList.value = await getEquipmentListApi(filters.type, filters.status)
  } catch {
    message.error('加载器材列表失败')
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
  modalTitle.value = '新增器材'
  editingId.value = null
  Object.assign(formState, {
    name: '',
    code: '',
    type: undefined,
    unit: undefined,
    totalQuantity: undefined,
    status: undefined,
  })
  modalVisible.value = true
}

async function handleEdit(record: EquipmentVO) {
  isEdit.value = true
  modalTitle.value = '编辑器材'
  editingId.value = record.id
  // Fetch the latest detail to ensure complete fields
  try {
    const detail = await getEquipmentByIdApi(record.id)
    Object.assign(formState, {
      name: detail.name,
      code: detail.code,
      type: detail.type || undefined,
      unit: detail.unit,
      totalQuantity: detail.totalQuantity,
      status: detail.status,
    })
  } catch {
    // Fallback to row data if detail fetch fails
    Object.assign(formState, {
      name: record.name,
      code: record.code,
      type: record.type || undefined,
      unit: record.unit,
      totalQuantity: record.totalQuantity,
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
      const dto: EquipmentUpdateDTO = {
        name: formState.name,
        code: formState.code,
        type: formState.type,
        unit: formState.unit,
        totalQuantity: formState.totalQuantity,
        status: formState.status,
      }
      await updateEquipmentApi(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: EquipmentCreateDTO = {
        name: formState.name,
        code: formState.code,
        type: formState.type,
        unit: formState.unit!,
        totalQuantity: formState.totalQuantity!,
      }
      await createEquipmentApi(dto)
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
function handleDelete(record: EquipmentVO) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除器材「${record.name}」吗？`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteEquipmentApi(record.id)
        message.success('删除成功')
        await loadList()
      } catch {
        message.error('删除失败')
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
.equipment-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
  .page-header {
    margin-bottom: @space-md;
  }
}
</style>
