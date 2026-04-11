import { ref, reactive } from 'vue'
import { message, Modal } from 'ant-design-vue'

interface CrudOptions {
  listApi: (params: Record<string, unknown>) => Promise<{
    records: unknown[]
    total: number
  }>
  createApi: (data: Record<string, unknown>) => Promise<unknown>
  updateApi: (id: number | string, data: Record<string, unknown>) => Promise<unknown>
  deleteApi: (id: number | string) => Promise<unknown>
}

export function useCrud(options: CrudOptions) {
  const loading = ref(false)
  const list = ref<unknown[]>([])

  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条记录`,
    pageSizeOptions: ['10', '20', '50'],
  })

  async function fetchList(params: Record<string, unknown> = {}) {
    loading.value = true
    try {
      const result = await options.listApi({
        current: pagination.current,
        size: pagination.pageSize,
        ...params,
      })
      list.value = result.records
      pagination.total = result.total
    } finally {
      loading.value = false
    }
  }

  async function handleCreate(formData: Record<string, unknown>) {
    await options.createApi(formData)
    message.success('创建成功')
    fetchList()
  }

  async function handleUpdate(id: number | string, formData: Record<string, unknown>) {
    await options.updateApi(id, formData)
    message.success('修改成功')
    fetchList()
  }

  function handleDelete(id: number | string) {
    return new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title: '确认删除',
        content: '确定要删除吗？此操作不可撤销。',
        okType: 'danger',
        async onOk() {
          try {
            await options.deleteApi(id)
            message.success('删除成功')
            fetchList()
            resolve()
          } catch (err) {
            reject(err)
          }
        },
      })
    })
  }

  return {
    loading,
    list,
    pagination,
    fetchList,
    handleCreate,
    handleUpdate,
    handleDelete,
  }
}