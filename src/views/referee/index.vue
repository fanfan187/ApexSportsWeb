<template>
  <div class="referee-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-input
          v-model:value="filters.level"
          placeholder="裁判等级"
          allowClear
          style="width: 150px"
        />
        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allowClear
          style="width: 120px"
        >
          <a-select-option :value="1">可用</a-select-option>
          <a-select-option :value="0">休息</a-select-option>
        </a-select>
        <a-input
          v-model:value="filters.keyword"
          placeholder="姓名"
          allowClear
          style="width: 150px"
        />
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Header with Add button (admin only) -->
    <div class="page-header">
      <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
        新增裁判
      </a-button>
    </div>

    <!-- Table with server-side pagination -->
    <a-table
      :columns="columns"
      :data-source="refereeList"
      :loading="loading"
      :pagination="paginationConfig"
      :expanded-row-keys="expandedRowKeys"
      row-key="id"
      @change="handleTableChange"
      @expanded-rows-change="handleExpandedRowsChange"
      @expand="handleExpand"
    >
      <template #bodyCell="{ column, record }">
        <!-- Gender column -->
        <template v-if="column.key === 'gender'">
          <StatusTag :status="(record as RefereeVO).gender" type="gender" />
        </template>
        <!-- Status column -->
        <template v-if="column.key === 'status'">
          <!-- TODO T10: 换 StatusTag type="refereeStatus"，Task 10 补此 type 后切换 -->
          <a-tag :color="(record as RefereeVO).status === 1 ? 'green' : 'default'">
            {{ (record as RefereeVO).status === 1 ? '可用' : '休息' }}
          </a-tag>
        </template>
        <!-- Level column -->
        <template v-if="column.key === 'level'">
          {{ (record as RefereeVO).level || '-' }}
        </template>
        <!-- Phone column -->
        <template v-if="column.key === 'phone'">
          {{ (record as RefereeVO).phone || '-' }}
        </template>
        <!-- CreatedAt column -->
        <template v-if="column.key === 'createdAt'">
          {{
            (record as RefereeVO).createdAt
              ? dayjs((record as RefereeVO).createdAt).format('YYYY-MM-DD HH:mm:ss')
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
              @click="handleEdit(record as RefereeVO)"
            >
              编辑
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
              @click="handleDelete(record as RefereeVO)"
            >
              删除
            </a-button>
          </a-space>
        </template>
      </template>

      <!-- Expanded row: referee schedule with conflict detection -->
      <template #expandedRowRender="{ record }">
        <div class="schedule-panel">
          <div class="schedule-toolbar">
            <span class="schedule-title">
              裁判「{{ (record as RefereeVO).name }}」赛程安排
            </span>
          </div>

          <!-- Conflict alert -->
          <a-alert
            v-if="getConflictCount((record as RefereeVO).id) > 0"
            type="warning"
            show-icon
            :message="`检测到 ${getConflictCount((record as RefereeVO).id)} 个时间冲突，请检查高亮行`"
            style="margin-bottom: 8px"
          />

          <!-- Empty state -->
          <a-empty
            v-if="!scheduleCache[(record as RefereeVO).id] || scheduleCache[(record as RefereeVO).id].length === 0"
            description="暂无赛程安排"
            :image="undefined"
          />

          <!-- Schedule sub-table -->
          <a-table
            v-else
            :columns="scheduleColumns"
            :data-source="scheduleCache[(record as RefereeVO).id]"
            :loading="!!scheduleLoading[(record as RefereeVO).id]"
            :row-key="(subRecord: RefereeScheduleVO, index: number) => scheduleRowKey(subRecord, index)"
            :pagination="false"
            size="small"
            :row-class-name="(subRecord: RefereeScheduleVO, index: number) => getConflictKeys((record as RefereeVO).id).has(scheduleRowKey(subRecord, index)) ? 'conflict-row' : ''"
          >
            <template #bodyCell="{ column: subCol, record: subRecord }">
              <!-- Time column -->
              <template v-if="subCol.key === 'time'">
                {{ formatScheduleTime((subRecord as RefereeScheduleVO).startTime, (subRecord as RefereeScheduleVO).endTime) }}
              </template>
              <!-- Role column (a-tag fallback, T10 换 StatusTag type="refereeRole") -->
              <template v-if="subCol.key === 'role'">
                <a-tag :color="refereeRoleMap[(subRecord as RefereeScheduleVO).role]?.color || 'default'">
                  {{ refereeRoleMap[(subRecord as RefereeScheduleVO).role]?.text || '未知' }}
                </a-tag>
              </template>
              <!-- Competition status column (a-tag fallback, T10 换 StatusTag type="competitionStatus") -->
              <template v-if="subCol.key === 'competitionStatus'">
                <a-tag :color="competitionStatusMap[(subRecord as RefereeScheduleVO).competitionStatus]?.color || 'default'">
                  {{ competitionStatusMap[(subRecord as RefereeScheduleVO).competitionStatus]?.text || '未知' }}
                </a-tag>
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
        <a-form-item label="姓名" name="name">
          <a-input
            v-model:value="formState.name"
            placeholder="请输入姓名"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item label="性别" name="gender">
          <a-select v-model:value="formState.gender" placeholder="请选择性别">
            <a-select-option :value="1">男</a-select-option>
            <a-select-option :value="0">女</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="联系电话" name="phone">
          <a-input
            v-model:value="formState.phone"
            placeholder="请输入联系电话（可选）"
            :maxlength="20"
          />
        </a-form-item>
        <a-form-item label="裁判等级" name="level">
          <a-input
            v-model:value="formState.level"
            placeholder="请输入裁判等级（可选）"
            :maxlength="50"
          />
        </a-form-item>
        <!-- Status field only in edit mode -->
        <a-form-item v-if="isEdit" label="状态" name="status">
          <a-select v-model:value="formState.status" placeholder="请选择状态">
            <a-select-option :value="1">可用</a-select-option>
            <a-select-option :value="0">休息</a-select-option>
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
  getRefereeListApi,
  getRefereeByIdApi,
  createRefereeApi,
  updateRefereeApi,
  deleteRefereeApi,
  getRefereeScheduleApi,
  type RefereeVO,
  type RefereeCreateDTO,
  type RefereeUpdateDTO,
  type RefereeQueryParams,
  type RefereeScheduleVO,
} from '@/api/referee'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const refereeList = ref<RefereeVO[]>([])
const loading = ref(false)

// === Pagination config (server-side) ===
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
})

// === Filter bar state ===
const filters = reactive<RefereeQueryParams>({
  level: '',
  status: undefined,
  keyword: '',
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
  gender: undefined as number | undefined,
  phone: '',
  level: '',
  status: undefined as number | undefined,
})

// === Form rules ===
const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '性别', dataIndex: 'gender', key: 'gender', width: 100 },
  { title: '电话', dataIndex: 'phone', key: 'phone', width: 150 },
  { title: '等级', dataIndex: 'level', key: 'level' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' },
]

// === Schedule expand state ===
const expandedRowKeys = ref<number[]>([])
const scheduleCache = ref<Record<number, RefereeScheduleVO[]>>({})
const scheduleLoading = ref<Record<number, boolean>>({})

// === Schedule sub-table columns (RefereeScheduleVO) ===
const scheduleColumns: TableColumnsType = [
  { title: '比赛时间', key: 'time', width: 200 },
  { title: '项目名称', dataIndex: 'eventName', key: 'eventName' },
  { title: '场地', dataIndex: 'venueName', key: 'venueName' },
  { title: '职务', key: 'role', width: 100 },
  { title: '比赛状态', key: 'competitionStatus', width: 100 },
]

// 职务映射（T10 会补 StatusTag type="refereeRole"，先用 a-tag 兜底）
const refereeRoleMap: Record<number, { text: string; color: string }> = {
  1: { text: '主裁判', color: 'red' },
  2: { text: '副裁判', color: 'orange' },
  3: { text: '计时员', color: 'blue' },
  4: { text: '记录员', color: 'default' },
}

// 比赛状态映射（T10 会补 StatusTag type="competitionStatus"，先用 a-tag 兜底）
const competitionStatusMap: Record<number, { text: string; color: string }> = {
  0: { text: '未开始', color: 'default' },
  1: { text: '进行中', color: 'processing' },
  2: { text: '已结束', color: 'success' },
  3: { text: '已取消', color: 'error' },
}

/**
 * 检测赛程中的时间冲突
 * 逻辑：若两条记录的 [startTime, endTime) 区间重叠，则标记为冲突
 * 区间重叠判断：a.startTime < b.endTime && b.startTime < a.endTime
 * @returns 冲突记录在数组中的下标集合（基于 startTime/endTime 的稳定 key）
 */
function detectConflicts(schedules: RefereeScheduleVO[]): Set<string> {
  const conflictKeys = new Set<string>()
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i]
      const b = schedules[j]
      if (a.startTime && a.endTime && b.startTime && b.endTime) {
        const aStart = dayjs(a.startTime)
        const aEnd = dayjs(a.endTime)
        const bStart = dayjs(b.startTime)
        const bEnd = dayjs(b.endTime)
        // 区间重叠：aStart < bEnd && bStart < aEnd
        if (aStart.isBefore(bEnd) && bStart.isBefore(aEnd)) {
          conflictKeys.add(scheduleRowKey(a, i))
          conflictKeys.add(scheduleRowKey(b, j))
        }
      }
    }
  }
  return conflictKeys
}

/**
 * 生成赛程行唯一 key（RefereeScheduleVO 无 id 字段，用组合 key）
 */
function scheduleRowKey(record: RefereeScheduleVO, fallbackIndex: number): string {
  return `${record.competitionId}-${record.startTime || ''}-${record.eventName}-${fallbackIndex}`
}

// === Expandable config ===
// 注意：antd-vue 4.x 的 Table 不支持 `expandable` 聚合 prop，
// 必须将 expandedRowKeys / onExpand / onExpandedRowsChange 作为顶层 props 传递。
// handleExpand / handleExpandedRowsChange 见下方定义（通过 @expand / @expanded-rows-change 绑定）

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    const result = await getRefereeListApi({
      current: paginationConfig.current,
      size: paginationConfig.pageSize,
      level: filters.level || undefined,
      status: filters.status,
      keyword: filters.keyword || undefined,
    })
    refereeList.value = result.records
    paginationConfig.total = result.total
  } catch {
    // 加载失败时清空列表与总数，避免展示过期脏数据
    refereeList.value = []
    paginationConfig.total = 0
    message.error('加载裁判列表失败')
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
    level: '',
    status: undefined,
    keyword: '',
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

// === Add/Edit handlers ===
function handleAdd() {
  isEdit.value = false
  modalTitle.value = '新增裁判'
  editingId.value = null
  Object.assign(formState, {
    name: '',
    gender: undefined,
    phone: '',
    level: '',
    status: undefined,
  })
  modalVisible.value = true
}

async function handleEdit(record: RefereeVO) {
  isEdit.value = true
  modalTitle.value = '编辑裁判'
  editingId.value = record.id
  // Fetch the latest detail to ensure complete fields (照抄 venue 模式)
  try {
    const detail = await getRefereeByIdApi(record.id)
    Object.assign(formState, {
      name: detail.name,
      gender: detail.gender,
      phone: detail.phone || '',
      level: detail.level || '',
      status: detail.status,
    })
  } catch {
    // Fallback to row data if detail fetch fails
    Object.assign(formState, {
      name: record.name,
      gender: record.gender,
      phone: record.phone || '',
      level: record.level || '',
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
      const dto: RefereeUpdateDTO = {
        name: formState.name,
        gender: formState.gender,
        phone: formState.phone || undefined,
        level: formState.level || undefined,
        status: formState.status,
      }
      await updateRefereeApi(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: RefereeCreateDTO = {
        name: formState.name,
        gender: formState.gender!,
        phone: formState.phone || undefined,
        level: formState.level || undefined,
      }
      await createRefereeApi(dto)
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
function handleDelete(record: RefereeVO) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除裁判「${record.name}」吗？`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteRefereeApi(record.id)
        message.success('删除成功')
        await loadList()
      } catch {
        message.error('删除失败')
      }
    },
  })
}

// === Expandable schedule ===
// 展开时懒加载赛程（不缓存，每次展开都重新请求，简单可靠）
// handleExpand 由 a-table 的 @expand 事件触发（antd-vue 4.x 顶层 prop）
async function handleExpand(expanded: boolean, record: RefereeVO) {
  if (expanded) {
    expandedRowKeys.value = [...expandedRowKeys.value, record.id]
    scheduleLoading.value = { ...scheduleLoading.value, [record.id]: true }
    try {
      const schedules = await getRefereeScheduleApi(record.id)
      // 整体替换对象引用，确保 Vue 响应式可靠触发
      scheduleCache.value = { ...scheduleCache.value, [record.id]: schedules }
    } catch {
      scheduleCache.value = { ...scheduleCache.value, [record.id]: [] }
      message.error('加载赛程失败')
    } finally {
      scheduleLoading.value = { ...scheduleLoading.value, [record.id]: false }
    }
  } else {
    expandedRowKeys.value = expandedRowKeys.value.filter((key) => key !== record.id)
  }
}

/**
 * expandedRowKeys 受控更新（由 a-table 的 @expanded-rows-change 触发）
 */
function handleExpandedRowsChange(rows: (string | number)[]) {
  expandedRowKeys.value = rows as number[]
}

// === Schedule helpers ===
/**
 * 格式化比赛时间区间：startTime ~ endTime
 */
function formatScheduleTime(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return '-'
  const s = dayjs(startTime).format('YYYY-MM-DD HH:mm')
  const e = dayjs(endTime).format('HH:mm')
  return `${s} ~ ${e}`
}

/**
 * 获取某裁判的冲突 key 集合
 */
function getConflictKeys(refereeId: number): Set<string> {
  const schedules = scheduleCache.value[refereeId]
  if (!schedules || schedules.length === 0) return new Set()
  return detectConflicts(schedules)
}

/**
 * 获取某裁判的冲突数量
 */
function getConflictCount(refereeId: number): number {
  return getConflictKeys(refereeId).size
}

// === Lifecycle ===
onMounted(() => {
  loadList()
})
</script>

<style scoped lang="less">
.referee-page {
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

// 冲突行红色高亮（浅红色背景）
:deep(.conflict-row) {
  background-color: #fff2f0;

  &:hover > td {
    background-color: #ffe7e4 !important;
  }
}
</style>
