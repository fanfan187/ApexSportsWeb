<template>
  <div class="college-page">
    <!-- Header with Add button (admin only) -->
    <div class="page-header">
      <a-button v-if="userStore.isAdmin" type="primary" @click="handleAdd">
        新增学院
      </a-button>
    </div>

    <!-- Table -->
    <a-table
      :columns="columns"
      :data-source="collegeList"
      :loading="loading"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              size="small"
              @click="handleEdit(record as CollegeVO)"
            >
              编辑
            </a-button>
            <a-button
              v-if="userStore.isAdmin"
              type="link"
              danger
              size="small"
              @click="handleDelete(record as CollegeVO)"
            >
              删除
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- Add/Edit Dialog -->
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
        <a-form-item label="学院名称" name="name">
          <a-input
            v-model:value="formState.name"
            placeholder="请输入学院名称"
            :maxlength="100"
          />
        </a-form-item>
        <a-form-item label="学院代码" name="code">
          <a-input
            v-model:value="formState.code"
            placeholder="请输入学院代码"
            :maxlength="20"
          />
        </a-form-item>
        <a-form-item label="学院描述" name="description">
          <a-textarea
            v-model:value="formState.description"
            placeholder="请输入学院描述（可选）"
            :maxlength="500"
            :rows="3"
          />
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
  getCollegeListApi,
  createCollegeApi,
  updateCollegeApi,
  deleteCollegeApi,
  type CollegeVO,
  type CollegeCreateDTO,
  type CollegeUpdateDTO,
} from '@/api/college'

// === Store ===
const userStore = useUserStore()

// === Table state ===
const collegeList = ref<CollegeVO[]>([])
const loading = ref(false)

// === Modal state ===
const modalVisible = ref(false)
const modalTitle = ref('')
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitLoading = ref(false)
const formRef = ref<FormInstance>()

// === Form reactive object ===
const formState = reactive({
  name: '',
  code: '',
  description: '',
})

// === Form rules ===
const rules = {
  name: [{ required: true, message: '请输入学院名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入学院代码', trigger: 'blur' }],
}

// === Table columns ===
const columns: TableColumnsType = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    customRender: ({ text }) =>
      text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    customRender: ({ text }) =>
      text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
  },
  { title: '操作', key: 'action', width: 150 },
]

// === Data loading ===
async function loadList() {
  loading.value = true
  try {
    collegeList.value = await getCollegeListApi()
  } finally {
    loading.value = false
  }
}

// === Add/Edit handlers ===
function handleAdd() {
  isEdit.value = false
  modalTitle.value = '新增学院'
  editingId.value = null
  Object.assign(formState, { name: '', code: '', description: '' })
  modalVisible.value = true
}

function handleEdit(record: CollegeVO) {
  isEdit.value = true
  modalTitle.value = '编辑学院'
  editingId.value = record.id
  Object.assign(formState, {
    name: record.name,
    code: record.code,
    description: record.description || '',
  })
  modalVisible.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validateFields()
    submitLoading.value = true
    if (isEdit.value && editingId.value) {
      const dto: CollegeUpdateDTO = { ...formState }
      await updateCollegeApi(editingId.value, dto)
      message.success('修改成功')
    } else {
      const dto: CollegeCreateDTO = { ...formState }
      await createCollegeApi(dto)
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
function handleDelete(record: CollegeVO) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除学院「${record.name}」吗？`,
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      await deleteCollegeApi(record.id)
      message.success('删除成功')
      await loadList()
    },
  })
}

// === Lifecycle ===
onMounted(() => {
  loadList()
})
</script>

<style scoped lang="less">
.college-page {
  .page-header {
    margin-bottom: @space-md;
  }
}
</style>
