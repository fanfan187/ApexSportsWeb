<template>
  <div class="equipment-tab">
    <!-- 操作栏 -->
    <div class="action-bar">
      <a-button type="primary" :loading="loading" @click="handleAssign">分配器材</a-button>
    </div>

    <!-- 器材使用列表 -->
    <a-table
      :columns="columns"
      :data-source="dataList"
      :loading="loading"
      row-key="id"
      :pagination="false"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="EQUIPMENT_STATUS_COLOR_MAP[(record as CompetitionEquipment).status] ?? 'default'">
            {{ EQUIPMENT_STATUS_MAP[(record as CompetitionEquipment).status] ?? '未知' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'remark'">
          <span>{{ (record as CompetitionEquipment).remark || '-' }}</span>
        </template>
        <template v-if="column.key === 'action'">
          <a-select
            v-if="(record as CompetitionEquipment).status < 2"
            :value="undefined"
            placeholder="变更状态"
            style="width: 130px"
            size="small"
            :options="nextStatusOptions((record as CompetitionEquipment).status)"
            @change="(v: number) => handleStatusChange(record as CompetitionEquipment, v)"
          />
          <a-button v-else type="link" size="small" disabled>已完成</a-button>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="暂无器材分配" />
      </template>
    </a-table>

    <!-- 分配器材 Modal -->
    <a-modal
      v-model:open="modalVisible"
      title="分配器材"
      :confirm-loading="modalLoading"
      width="520px"
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
        <a-form-item label="器材" name="equipmentId">
          <a-select
            v-model:value="form.equipmentId"
            placeholder="请选择器材"
            :loading="equipmentListLoading"
            :options="equipmentOptions"
            :field-names="{ label: 'name', value: 'id' }"
            show-search
            option-filter-prop="name"
          />
        </a-form-item>
        <a-form-item label="数量" name="quantity">
          <a-input-number v-model:value="form.quantity" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-textarea
            v-model:value="form.remark"
            :rows="3"
            placeholder="请输入备注（可选）"
            :maxlength="200"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import type { TableColumnsType } from 'ant-design-vue'
import {
  assignEquipment,
  getEquipments,
  updateEquipmentStatus,
} from '@/api/competition'
import { getEquipmentListApi, type EquipmentVO } from '@/api/equipment'
import {
  EQUIPMENT_STATUS_MAP,
  EQUIPMENT_STATUS_COLOR_MAP,
} from '@/views/schedule/constants'
import type { CompetitionEquipment, AssignEquipmentDTO } from '@/views/schedule/types'

// === Props ===
const props = defineProps<{
  competitionId: number
}>()

// === 数据状态 ===
const loading = ref(false)
const dataList = ref<CompetitionEquipment[]>([])

// === Modal 状态 ===
const modalVisible = ref(false)
const modalLoading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive<{
  equipmentId: number | undefined
  quantity: number
  remark: string
}>({
  equipmentId: undefined,
  quantity: 1,
  remark: '',
})

const rules = {
  equipmentId: [{ required: true, message: '请选择器材', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
}

// === 器材列表（Modal Select 数据源） ===
const equipmentListLoading = ref(false)
const equipmentOptions = ref<EquipmentVO[]>([])

async function loadEquipmentOptions() {
  equipmentListLoading.value = true
  try {
    equipmentOptions.value = await getEquipmentListApi()
  } catch {
    equipmentOptions.value = []
  } finally {
    equipmentListLoading.value = false
  }
}

// === 状态流转选项 ===
// 流转规则：0(已分配)→1(使用中)，1(使用中)→2(已归还)，2(已归还)不可变更
function nextStatusOptions(currentStatus: number): { value: number; label: string }[] {
  if (currentStatus === 0) {
    return [{ value: 1, label: '→ 使用中' }]
  }
  if (currentStatus === 1) {
    return [{ value: 2, label: '→ 已归还' }]
  }
  return []
}

// === 表格列 ===
const columns: TableColumnsType = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '器材名称', dataIndex: 'equipmentName', key: 'equipmentName' },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90 },
  { title: '状态', key: 'status', width: 110 },
  { title: '备注', key: 'remark' },
  { title: '操作', key: 'action', width: 160, fixed: 'right' },
]

// === 数据加载 ===
async function loadEquipments() {
  if (!props.competitionId) {
    dataList.value = []
    return
  }
  loading.value = true
  try {
    dataList.value = await getEquipments(props.competitionId)
  } finally {
    loading.value = false
  }
}

// === 分配器材 ===
function handleAssign() {
  Object.assign(form, { equipmentId: undefined, quantity: 1, remark: '' })
  loadEquipmentOptions()
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    modalLoading.value = true
    const dto: AssignEquipmentDTO = {
      equipmentId: form.equipmentId!,
      quantity: form.quantity,
      remark: form.remark || undefined,
    }
    await assignEquipment(props.competitionId, dto)
    message.success('分配成功')
    modalVisible.value = false
    await loadEquipments()
  } finally {
    modalLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
}

// === 状态变更 ===
async function handleStatusChange(record: CompetitionEquipment, nextStatus: number) {
  await updateEquipmentStatus(props.competitionId, record.id, { status: nextStatus })
  message.success('状态更新成功')
  await loadEquipments()
}

// === 监听 competitionId 变化重新加载 ===
watch(() => props.competitionId, loadEquipments)

// === 生命周期 ===
onMounted(() => {
  loadEquipments()
})
</script>

<style scoped lang="less">
.equipment-tab {
  .action-bar {
    margin-bottom: @space-md;
    text-align: right;
  }
}
</style>
