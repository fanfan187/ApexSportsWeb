<template>
  <div class="athlete-page">
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
        <a-input
          v-model:value="filters.name"
          placeholder="姓名"
          allowClear
          style="width: 150px"
        />
        <a-input
          v-model:value="filters.studentNo"
          placeholder="学号"
          allowClear
          style="width: 150px"
        />
        <a-select
          v-model:value="filters.status"
          placeholder="状态"
          allowClear
          style="width: 120px"
        >
          <a-select-option :value="1">正常</a-select-option>
          <a-select-option :value="0">禁赛</a-select-option>
        </a-select>
        <a-select
          v-model:value="filters.gender"
          placeholder="性别"
          allowClear
          style="width: 120px"
        >
          <a-select-option :value="1">男</a-select-option>
          <a-select-option :value="0">女</a-select-option>
        </a-select>
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <!-- Header with Add button (admin only) -->
    <div class="page-header">
      <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
        新增运动员
      </a-button>
    </div>

    <!-- Table with server-side pagination -->
    <a-table
      :columns="columns"
      :data-source="athleteList"
      :loading="loading"
      :pagination="paginationConfig"
      row-key="id"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <!-- Gender column -->
        <template v-if="column.key === 'gender'">
          <StatusTag :status="(record as AthleteVO).gender" type="gender" />
        </template>
        <!-- Status column -->
        <template v-if="column.key === 'status'">
          <StatusTag :status="(record as AthleteVO).status" type="enable" />
        </template>
        <!-- CreatedAt column -->
        <template v-if="column.key === 'createdAt'">
          {{ (record as AthleteVO).createdAt ? dayjs((record as AthleteVO).createdAt).format('YYYY-MM-DD HH:mm:ss') : '-' }}
        </template>
        <!-- Action column -->
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              size="small"
              @click="handleEdit(record as AthleteVO)"
            >
              编辑
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
              @click="handleDelete(record as AthleteVO)"
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
        <a-form-item label="姓名" name="name">
          <a-input
            v-model:value="formState.name"
            placeholder="请输入姓名"
            :maxlength="50"
          />
        </a-form-item>
        <a-form-item label="学号" name="studentNo">
          <a-input
            v-model:value="formState.studentNo"
            placeholder="请输入学号"
            :maxlength="30"
          />
        </a-form-item>
        <a-form-item label="性别" name="gender">
          <a-select v-model:value="formState.gender" placeholder="请选择性别">
            <a-select-option :value="1">男</a-select-option>
            <a-select-option :value="0">女</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="年级" name="grade">
          <a-input
            v-model:value="formState.grade"
            placeholder="请输入年级（可选）"
            :maxlength="20"
          />
        </a-form-item>
        <a-form-item label="联系电话" name="phone">
          <a-input
            v-model:value="formState.phone"
            placeholder="请输入联系电话（可选）"
            :maxlength="20"
          />
        </a-form-item>
        <!-- Status field only in edit mode -->
        <a-form-item v-if="isEdit" label="状态" name="status">
          <a-select v-model:value="formState.status" placeholder="请选择状态">
            <a-select-option :value="1">正常</a-select-option>
            <a-select-option :value="0">禁赛</a-select-option>
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
  getAthleteListApi,
  createAthleteApi,
  updateAthleteApi,
  deleteAthleteApi,
  type AthleteVO,
  type AthleteCreateDTO,
  type AthleteUpdateDTO,
  type AthleteQueryParams,
} from '@/api/athlete'
import { getCollegeListApi, type CollegeVO } from '@/api/college'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const athleteList = ref<AthleteVO[]>([])
const loading = ref(false)

// === Pagination config (inlined, not imported from useCrud) ===
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
})

// === Filter bar state ===
const filters = reactive<AthleteQueryParams>({
  collegeId: undefined,
  name: '',
  studentNo: '',
  status: undefined,
  gender: undefined,
})

// === College dropdown options ===
const collegeOptions = ref<CollegeVO[]>([])

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// === Form state ===
const formState = reactive({
  collegeId: undefined as number | undefined,
  name: '',
  studentNo: '',
  gender: undefined as number | undefined,
  grade: '',
  phone: '',
  status: undefined as number | undefined,
})

// === Form rules ===
const rules = {
  collegeId: [{ required: true, message: '请选择学院', trigger: 'change' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  studentNo: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '学号', dataIndex: 'studentNo', key: 'studentNo' },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '性别', dataIndex: 'gender', key: 'gender' },
  { title: '学院', dataIndex: 'collegeName', key: 'collegeName' },
  { title: '年级', dataIndex: 'grade', key: 'grade' },
  { title: '电话', dataIndex: 'phone', key: 'phone' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action', width: 150 },
]

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    const result = await getAthleteListApi({
      current: paginationConfig.current,
      size: paginationConfig.pageSize,
      ...filters,
    })
    athleteList.value = result.records
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
    name: '',
    studentNo: '',
    status: undefined,
    gender: undefined,
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
  modalTitle.value = '新增运动员'
  editingId.value = null
  Object.assign(formState, {
    collegeId: undefined,
    name: '',
    studentNo: '',
    gender: undefined,
    grade: '',
    phone: '',
    status: undefined,
  })
  modalVisible.value = true
}

function handleEdit(record: AthleteVO) {
  isEdit.value = true
  modalTitle.value = '编辑运动员'
  editingId.value = record.id
  Object.assign(formState, {
    collegeId: record.collegeId,
    name: record.name,
    studentNo: record.studentNo,
    gender: record.gender,
    grade: record.grade || '',
    phone: record.phone || '',
    status: record.status,
  })
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    submitLoading.value = true
    if (isEdit.value && editingId.value) {
      const dto: AthleteUpdateDTO = {
        collegeId: formState.collegeId,
        name: formState.name,
        studentNo: formState.studentNo,
        gender: formState.gender,
        grade: formState.grade || undefined,
        phone: formState.phone || undefined,
        status: formState.status,
      }
      await updateAthleteApi(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: AthleteCreateDTO = {
        collegeId: formState.collegeId!,
        name: formState.name,
        studentNo: formState.studentNo,
        gender: formState.gender!,
        grade: formState.grade || undefined,
        phone: formState.phone || undefined,
      }
      await createAthleteApi(dto)
      message.success('创建成功')
    }
    modalVisible.value = false
    await loadList()
  } finally {
    submitLoading.value = false
  }
}

function handleModalClose() {
  formRef.value?.resetFields()
}

// === Delete handler ===
function handleDelete(record: AthleteVO) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除运动员「${record.name}」吗？`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      await deleteAthleteApi(record.id)
      message.success('删除成功')
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
})
</script>

<style scoped lang="less">
.athlete-page {
  .filter-bar {
    margin-bottom: @space-md;
  }
  .page-header {
    margin-bottom: @space-md;
  }
}
</style>
