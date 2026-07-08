<template>
  <div class="schedule-page">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <a-space wrap>
        <a-date-picker
          v-model:value="filterDate"
          placeholder="比赛日期"
          allowClear
          style="width: 160px"
          @change="(_d: unknown, dateStr: string) => onDateChange(dateStr)"
        />
        <a-select
          v-model:value="queryParams.venueId"
          placeholder="场地"
          allowClear
          style="width: 160px"
          :options="venueOptions"
          :field-names="{ label: 'name', value: 'id' }"
          @change="fetchData"
        />
        <a-select
          v-model:value="queryParams.eventId"
          placeholder="比赛项目"
          allowClear
          show-search
          style="width: 180px"
          :options="eventOptions"
          :field-names="{ label: 'name', value: 'id' }"
          :filter-option="filterOption"
          @change="fetchData"
        />
        <a-select
          v-model:value="queryParams.status"
          placeholder="状态"
          allowClear
          style="width: 140px"
          @change="fetchData"
        >
          <a-select-option
            v-for="[k, v] in Object.entries(STATUS_MAP)"
            :key="k"
            :value="Number(k)"
          >
            {{ v }}
          </a-select-option>
        </a-select>
        <a-select
          v-model:value="queryParams.round"
          placeholder="轮次"
          allowClear
          style="width: 140px"
          @change="fetchData"
        >
          <a-select-option
            v-for="[k, v] in Object.entries(ROUND_MAP)"
            :key="k"
            :value="Number(k)"
          >
            {{ v }}
          </a-select-option>
        </a-select>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Action Bar -->
    <div class="action-bar">
      <a-space>
        <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
          新建场次
        </a-button>
        <router-link to="/schedule/booklet">
          <a-button>查看秩序册</a-button>
        </router-link>
      </a-space>
    </div>

    <!-- Table -->
    <a-table
      :columns="columns"
      :data-source="dataList"
      :loading="loading"
      row-key="id"
      :pagination="paginationConfig"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'eventType'">
          {{ EVENT_TYPE_MAP[(record as Competition).eventType] ?? '-' }}
        </template>
        <template v-if="column.key === 'eventCategory'">
          {{ EVENT_CATEGORY_MAP[(record as Competition).eventCategory] ?? '-' }}
        </template>
        <template v-if="column.key === 'round'">
          {{ ROUND_MAP[(record as Competition).round] ?? '-' }}
        </template>
        <template v-if="column.key === 'startTime'">
          {{ formatDateTime((record as Competition).startTime) }}
        </template>
        <template v-if="column.key === 'endTime'">
          {{ formatDateTime((record as Competition).endTime) }}
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="STATUS_COLOR_MAP[(record as Competition).status] ?? 'default'">
            {{ STATUS_MAP[(record as Competition).status] ?? '未知' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              type="link"
              size="small"
              @click="handleView(record as Competition)"
            >
              查看
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              size="small"
              @click="handleEdit(record as Competition)"
            >
              编辑
            </a-button>
            <a-dropdown v-if="userStore.isAdmin">
              <a-button type="link" size="small" @click.prevent>
                状态<DownOutlined />
              </a-button>
              <template #overlay>
                <a-menu @click="(info: { key: string }) => handleStatusChange(record as Competition, Number(info.key))">
                  <a-menu-item
                    v-for="opt in statusOptionsFor(record as Competition)"
                    :key="opt.value"
                  >
                    {{ opt.label }}
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <a-popconfirm
              v-if="userStore.isAdmin"
              title="确认删除该场次？"
              ok-text="删除"
              cancel-text="取消"
              @confirm="handleDelete(record as Competition)"
            >
              <a-button type="link" danger size="small">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- Add/Edit Modal -->
    <a-modal
      v-model:open="modalVisible"
      :title="modalTitle"
      :confirm-loading="modalLoading"
      width="640px"
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
        <a-form-item label="比赛项目" name="eventId">
          <a-select
            v-model:value="form.eventId"
            placeholder="请选择比赛项目"
            show-search
            :options="eventOptions"
            :field-names="{ label: 'name', value: 'id' }"
            :filter-option="filterOption"
          />
        </a-form-item>
        <a-form-item label="场地" name="venueId">
          <a-select
            v-model:value="form.venueId"
            placeholder="请选择场地"
            :options="venueOptions"
            :field-names="{ label: 'name', value: 'id' }"
          />
        </a-form-item>
        <a-form-item label="轮次" name="round">
          <a-select v-model:value="form.round" placeholder="请选择轮次">
            <a-select-option
              v-for="[k, v] in Object.entries(ROUND_MAP)"
              :key="k"
              :value="Number(k)"
            >
              {{ v }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="组别" name="groupNo">
          <a-input-number v-model:value="form.groupNo" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item label="开始时间" name="startTime">
          <a-date-picker
            v-model:value="form.startTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="选择开始时间"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="结束时间" name="endTime">
          <a-date-picker
            v-model:value="form.endTime"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            placeholder="选择结束时间"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-textarea
            v-model:value="form.remark"
            :rows="3"
            placeholder="请输入备注（可选）"
            :maxlength="500"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import type { TableColumnsType, PaginationProps } from 'ant-design-vue'
import { DownOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import { getEventListApi, type EventVO } from '@/api/event'
import { getVenueListApi, type VenueVO } from '@/api/venue'
import {
  getCompetitions,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  updateCompetitionStatus,
} from '@/api/competition'
import {
  STATUS_MAP,
  STATUS_COLOR_MAP,
  ROUND_MAP,
  EVENT_TYPE_MAP,
  EVENT_CATEGORY_MAP,
  COMPETITION_STATUS,
} from '@/views/schedule/constants'
import type {
  Competition,
  CompetitionCreateDTO,
  CompetitionQueryDTO,
} from '@/views/schedule/types'

// === Store / Router ===
const userStore = useUserStore()
const router = useRouter()

// === Data state ===
const loading = ref(false)
const dataList = ref<Competition[]>([])
const total = ref(0)

// === Filter state ===
const filterDate = ref<dayjs.Dayjs | undefined>(undefined)
const queryParams = reactive<CompetitionQueryDTO>({
  date: undefined,
  venueId: undefined,
  eventId: undefined,
  status: undefined,
  round: undefined,
  current: 1,
  size: 10,
})

// === Selector options ===
const eventOptions = ref<EventVO[]>([])
const venueOptions = ref<VenueVO[]>([])

function filterOption(input: string, option: { name?: string } | EventVO) {
  return !!option.name && option.name.toLowerCase().includes(input.toLowerCase())
}

// === Pagination ===
const paginationConfig = computed<PaginationProps>(() => ({
  current: queryParams.current,
  pageSize: queryParams.size,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t) => `共 ${t} 条`,
}))

function handleTableChange(pag: PaginationProps) {
  queryParams.current = pag?.current ?? 1
  queryParams.size = pag?.pageSize ?? 10
  fetchData()
}

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const modalLoading = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const form = reactive<{
  eventId: number | undefined
  venueId: number | undefined
  round: number | undefined
  groupNo: number
  startTime: string | undefined
  endTime: string | undefined
  remark: string
}>({
  eventId: undefined,
  venueId: undefined,
  round: undefined,
  groupNo: 1,
  startTime: undefined,
  endTime: undefined,
  remark: '',
})

const rules = {
  eventId: [{ required: true, message: '请选择比赛项目', trigger: 'change' }],
  venueId: [{ required: true, message: '请选择场地', trigger: 'change' }],
  round: [{ required: true, message: '请选择轮次', trigger: 'change' }],
  groupNo: [{ required: true, message: '请输入组别', trigger: 'blur' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '项目名称', dataIndex: 'eventName', key: 'eventName', width: 160 },
  { title: '类型', key: 'eventType', width: 80 },
  { title: '类别', key: 'eventCategory', width: 80 },
  { title: '场地', dataIndex: 'venueName', key: 'venueName', width: 140 },
  { title: '轮次', key: 'round', width: 80 },
  { title: '组别', dataIndex: 'groupNo', key: 'groupNo', width: 70 },
  { title: '开始时间', key: 'startTime', width: 160 },
  { title: '结束时间', key: 'endTime', width: 160 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 260, fixed: 'right' },
]

// === Status transition options (only forward transitions per backend) ===
function statusOptionsFor(record: Competition): { value: number; label: string }[] {
  const opts: { value: number; label: string }[] = []
  // 未开始 → 进行中 / 取消
  if (record.status === COMPETITION_STATUS.NOT_STARTED) {
    opts.push({ value: COMPETITION_STATUS.IN_PROGRESS, label: '开始比赛' })
    opts.push({ value: COMPETITION_STATUS.CANCELLED, label: '取消比赛' })
  }
  // 进行中 → 已结束 / 取消
  if (record.status === COMPETITION_STATUS.IN_PROGRESS) {
    opts.push({ value: COMPETITION_STATUS.FINISHED, label: '结束比赛' })
    opts.push({ value: COMPETITION_STATUS.CANCELLED, label: '取消比赛' })
  }
  return opts
}

// === Data loading ===
async function fetchData() {
  loading.value = true
  try {
    const res = await getCompetitions({ ...queryParams })
    dataList.value = res.records
    total.value = res.total
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    const [events, venues] = await Promise.all([
      getEventListApi({ status: 1 }),
      getVenueListApi(undefined, 1),
    ])
    eventOptions.value = events
    venueOptions.value = venues
  } catch {
    // 选项加载失败不阻塞列表
  }
}

// === Filter handlers ===
function onDateChange(dateStr: string) {
  queryParams.date = dateStr || undefined
  queryParams.current = 1
  fetchData()
}

function handleReset() {
  filterDate.value = undefined
  Object.assign(queryParams, {
    date: undefined,
    venueId: undefined,
    eventId: undefined,
    status: undefined,
    round: undefined,
    current: 1,
    size: 10,
  })
  fetchData()
}

// === Add handler ===
function handleAdd() {
  isEdit.value = false
  editingId.value = null
  modalTitle.value = '新建场次'
  Object.assign(form, {
    eventId: undefined,
    venueId: undefined,
    round: undefined,
    groupNo: 1,
    startTime: undefined,
    endTime: undefined,
    remark: '',
  })
  modalVisible.value = true
}

// === Edit handler ===
async function handleEdit(record: Competition) {
  isEdit.value = true
  editingId.value = record.id
  modalTitle.value = '编辑场次'
  Object.assign(form, {
    eventId: record.eventId,
    venueId: record.venueId,
    round: record.round,
    groupNo: record.groupNo,
    startTime: record.startTime,
    endTime: record.endTime,
    remark: record.remark ?? '',
  })
  modalVisible.value = true
}

// === Submit handler ===
async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    modalLoading.value = true
    if (isEdit.value && editingId.value) {
      const dto: Parameters<typeof updateCompetition>[1] = {
        eventId: form.eventId,
        venueId: form.venueId,
        round: form.round,
        groupNo: form.groupNo,
        startTime: form.startTime,
        endTime: form.endTime,
        remark: form.remark || undefined,
      }
      await updateCompetition(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: CompetitionCreateDTO = {
        eventId: form.eventId!,
        venueId: form.venueId!,
        round: form.round!,
        groupNo: form.groupNo,
        startTime: form.startTime!,
        endTime: form.endTime!,
        remark: form.remark || undefined,
      }
      await createCompetition(dto)
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
async function handleDelete(record: Competition) {
  await deleteCompetition(record.id)
  message.success('删除成功')
  // 删除后若当前页空了，回退一页
  if (dataList.value.length === 1 && queryParams.current && queryParams.current > 1) {
    queryParams.current -= 1
  }
  await fetchData()
}

// === Status transition ===
async function handleStatusChange(record: Competition, target: number) {
  try {
    await updateCompetitionStatus(record.id, { status: target })
    message.success('状态更新成功')
    await fetchData()
  } catch {
    // 拦截器统一处理
  }
}

// === View detail ===
function handleView(record: Competition) {
  router.push(`/schedule/${record.id}`)
}

// === Helpers ===
function formatDateTime(value: string): string {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
}

// === Lifecycle ===
onMounted(() => {
  loadOptions()
  fetchData()
})
</script>

<style scoped lang="less">
.schedule-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
  .action-bar {
    margin-bottom: @space-md;
  }
}
</style>
