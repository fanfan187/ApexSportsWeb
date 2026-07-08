<template>
  <div class="referee-tab">
    <!-- 操作栏 -->
    <div class="action-bar">
      <a-button type="primary" :loading="loading" @click="handleAssign">分配裁判</a-button>
    </div>

    <!-- 裁判分配列表 -->
    <a-table
      :columns="columns"
      :data-source="dataList"
      :loading="loading"
      row-key="id"
      :pagination="false"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'role'">
          <a-tag :color="roleColorMap[(record as RefereeAssignment).role] ?? 'default'">
            {{ REFEREE_ROLE_MAP[(record as RefereeAssignment).role] ?? '未知' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="statusInfo.color">{{ statusInfo.text }}</a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-popconfirm
            title="确认移除该裁判分配？"
            ok-text="移除"
            cancel-text="取消"
            @confirm="handleRemove(record as RefereeAssignment)"
          >
            <a-button type="link" danger size="small">移除</a-button>
          </a-popconfirm>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="暂无裁判分配" />
      </template>
    </a-table>

    <!-- 分配裁判 Modal -->
    <a-modal
      v-model:open="modalVisible"
      title="分配裁判"
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
        <a-form-item label="裁判" name="refereeId">
          <a-select
            v-model:value="form.refereeId"
            placeholder="请选择裁判"
            :loading="refereeListLoading"
            :options="refereeOptions"
            :field-names="{ label: 'name', value: 'id' }"
            show-search
            option-filter-prop="name"
          />
        </a-form-item>
        <a-form-item label="职务" name="role">
          <a-select v-model:value="form.role" placeholder="请选择职务">
            <a-select-option
              v-for="opt in roleOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </a-select-option>
          </a-select>
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
  assignReferee,
  getRefereeAssignments,
  removeRefereeAssignment,
} from '@/api/competition'
import { getRefereeListApi, type RefereeVO } from '@/api/referee'
import { REFEREE_ROLE_MAP } from '@/views/schedule/constants'
import type { RefereeAssignment, AssignRefereeDTO } from '@/views/schedule/types'

// === Props ===
const props = defineProps<{
  competitionId: number
}>()

// === 数据状态 ===
const loading = ref(false)
const dataList = ref<RefereeAssignment[]>([])

// === Modal 状态 ===
const modalVisible = ref(false)
const modalLoading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive<{
  refereeId: number | undefined
  role: number | undefined
}>({
  refereeId: undefined,
  role: undefined,
})

const rules = {
  refereeId: [{ required: true, message: '请选择裁判', trigger: 'change' }],
  role: [{ required: true, message: '请选择职务', trigger: 'change' }],
}

// === 裁判列表（Modal Select 数据源） ===
const refereeListLoading = ref(false)
const refereeOptions = ref<RefereeVO[]>([])

async function loadRefereeOptions() {
  refereeListLoading.value = true
  try {
    const page = await getRefereeListApi({ current: 1, size: 100, status: 1 })
    refereeOptions.value = page.records
  } catch {
    // 拦截器统一处理，降级为空列表
    refereeOptions.value = []
  } finally {
    refereeListLoading.value = false
  }
}

// === 角色选项 / 颜色映射 ===
const roleOptions = Object.entries(REFEREE_ROLE_MAP).map(([k, v]) => ({
  value: Number(k),
  label: v,
}))

const roleColorMap: Record<number, string> = {
  1: 'red',
  2: 'orange',
  3: 'blue',
  4: 'green',
}

// 裁判分配状态（无独立映射，统一显示为已分配）
const statusInfo = { color: 'success', text: '已分配' }

// === 表格列 ===
const columns: TableColumnsType = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '裁判姓名', dataIndex: 'refereeName', key: 'refereeName' },
  { title: '职务', key: 'role', width: 110 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' },
]

// === 数据加载 ===
async function loadReferees() {
  if (!props.competitionId) {
    dataList.value = []
    return
  }
  loading.value = true
  try {
    dataList.value = await getRefereeAssignments(props.competitionId)
  } finally {
    loading.value = false
  }
}

// === 分配裁判 ===
function handleAssign() {
  Object.assign(form, { refereeId: undefined, role: undefined })
  loadRefereeOptions()
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    modalLoading.value = true
    const dto: AssignRefereeDTO = {
      refereeId: form.refereeId!,
      role: form.role!,
    }
    await assignReferee(props.competitionId, dto)
    message.success('分配成功')
    modalVisible.value = false
    await loadReferees()
  } finally {
    modalLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
}

// === 移除裁判 ===
async function handleRemove(record: RefereeAssignment) {
  await removeRefereeAssignment(props.competitionId, record.id)
  message.success('移除成功')
  await loadReferees()
}

// === 监听 competitionId 变化重新加载 ===
watch(() => props.competitionId, loadReferees)

// === 生命周期 ===
onMounted(() => {
  loadReferees()
})
</script>

<style scoped lang="less">
.referee-tab {
  .action-bar {
    margin-bottom: @space-md;
    text-align: right;
  }
}
</style>
