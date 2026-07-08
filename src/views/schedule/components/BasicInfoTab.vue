<template>
  <div class="basic-info-tab">
    <a-spin :spinning="loading">
      <!-- ===== View Mode ===== -->
      <template v-if="!isEditing">
        <div class="action-bar">
          <a-space>
            <!-- 状态流转操作区（按当前状态决定可流转动作） -->
            <a-button
              v-if="canStart"
              type="primary"
              :loading="statusUpdating"
              @click="handleStatusFlow(COMPETITION_STATUS.IN_PROGRESS)"
            >
              开始比赛
            </a-button>
            <a-button
              v-if="canCancel"
              danger
              :loading="statusUpdating"
              @click="handleStatusFlow(COMPETITION_STATUS.CANCELLED)"
            >
              取消比赛
            </a-button>
            <a-button
              v-if="canFinish"
              type="primary"
              :loading="statusUpdating"
              @click="handleStatusFlow(COMPETITION_STATUS.FINISHED)"
            >
              结束比赛
            </a-button>

            <!-- 编辑按钮（管理员可见） -->
            <a-button
              v-if="userStore.isAdmin && canEdit"
              type="link"
              @click="enterEdit"
            >
              编辑
            </a-button>
          </a-space>
        </div>

        <a-descriptions
          v-if="detail"
          bordered
          :column="2"
          size="middle"
        >
          <a-descriptions-item label="项目名称" :span="2">
            {{ detail.eventName }}
          </a-descriptions-item>
          <a-descriptions-item label="项目类型">
            <StatusTag :status="detail.eventType" type="eventType" />
          </a-descriptions-item>
          <a-descriptions-item label="项目类别">
            <StatusTag :status="detail.eventCategory" type="eventCategory" />
          </a-descriptions-item>
          <a-descriptions-item label="场地">
            {{ detail.venueName }}
          </a-descriptions-item>
          <a-descriptions-item label="轮次">
            <StatusTag :status="detail.round" type="round" />
          </a-descriptions-item>
          <a-descriptions-item label="组别">
            第 {{ detail.groupNo }} 组
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="STATUS_COLOR_MAP[detail.status]">
              {{ STATUS_MAP[detail.status] }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="开始时间">
            {{ formatTime(detail.startTime) }}
          </a-descriptions-item>
          <a-descriptions-item label="结束时间">
            {{ formatTime(detail.endTime) }}
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">
            {{ detail.remark || '—' }}
          </a-descriptions-item>
        </a-descriptions>

        <a-empty v-else description="暂无数据" />
      </template>

      <!-- ===== Edit Mode ===== -->
      <template v-else>
        <a-form
          ref="formRef"
          :model="form"
          :rules="rules"
          layout="vertical"
          class="edit-form"
        >
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="场地" name="venueId">
                <a-select
                  v-model:value="form.venueId"
                  placeholder="请选择场地"
                  :loading="venueLoading"
                  show-search
                  option-filter-prop="label"
                >
                  <a-select-option
                    v-for="v in venueList"
                    :key="v.id"
                    :value="v.id"
                    :label="v.name"
                  >
                    {{ v.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="轮次" name="round">
                <a-select v-model:value="form.round" placeholder="请选择轮次">
                  <a-select-option :value="1">预赛</a-select-option>
                  <a-select-option :value="2">决赛</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="组别" name="groupNo">
                <a-input-number
                  v-model:value="form.groupNo"
                  :min="1"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <!-- 占位，保持两列对齐 -->
              <span />
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="开始时间" name="startTime">
                <a-date-picker
                  v-model:value="form.startTime"
                  show-time
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DDTHH:mm:ss"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="结束时间" name="endTime">
                <a-date-picker
                  v-model:value="form.endTime"
                  show-time
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DDTHH:mm:ss"
                  style="width: 100%"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="备注" name="remark">
            <a-textarea
              v-model:value="form.remark"
              :rows="3"
              :maxlength="500"
              show-count
              placeholder="请输入备注（可选）"
            />
          </a-form-item>

          <div class="form-actions">
            <a-space>
              <a-button type="primary" :loading="saving" @click="handleSave">
                保存
              </a-button>
              <a-button @click="cancelEdit">取消</a-button>
            </a-space>
          </div>
        </a-form>
      </template>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import StatusTag from '@/components/StatusTag/index.vue'
import {
  getCompetition,
  updateCompetition,
  updateCompetitionStatus,
} from '@/api/competition'
import { getVenueListApi, type VenueVO } from '@/api/venue'
import {
  COMPETITION_STATUS,
  STATUS_MAP,
  STATUS_COLOR_MAP,
} from '../constants'
import type { Competition, CompetitionUpdateDTO } from '../types'

// ===== Props =====
const props = defineProps<{
  competitionId: number
}>()

// ===== Store =====
const userStore = useUserStore()

// ===== State =====
const loading = ref(false)
const saving = ref(false)
const statusUpdating = ref(false)
const isEditing = ref(false)
const formRef = ref<FormInstance>()

const detail = ref<Competition | null>(null)

// 场地选项（编辑模式下加载，按当前场地类型筛选更佳，此处取启用列表）
const venueList = ref<VenueVO[]>([])
const venueLoading = ref(false)

// ===== Form =====
const form = reactive<{
  venueId: number | undefined
  round: number | undefined
  groupNo: number | undefined
  startTime: string | undefined
  endTime: string | undefined
  remark: string
}>({
  venueId: undefined,
  round: undefined,
  groupNo: undefined,
  startTime: undefined,
  endTime: undefined,
  remark: '',
})

const rules = {
  venueId: [{ required: true, message: '请选择场地', trigger: 'change' }],
  round: [{ required: true, message: '请选择轮次', trigger: 'change' }],
  groupNo: [{ required: true, message: '请输入组别', trigger: 'blur' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
}

// ===== Status flow flags =====
// 流转规则: 0→1, 0→3, 1→2（不可逆）
const currentStatus = computed(() => detail.value?.status)
const canStart = computed(() => currentStatus.value === COMPETITION_STATUS.NOT_STARTED)
const canCancel = computed(() => currentStatus.value === COMPETITION_STATUS.NOT_STARTED)
const canFinish = computed(() => currentStatus.value === COMPETITION_STATUS.IN_PROGRESS)
// 仅未开始状态允许编辑基本信息（已开始/已结束/已取消场次不应再改基础信息）
const canEdit = computed(() => currentStatus.value === COMPETITION_STATUS.NOT_STARTED)

// ===== Time formatter =====
function formatTime(iso?: string): string {
  if (!iso) return '—'
  const d = dayjs(iso)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : iso
}

// ===== Data loading =====
async function loadDetail() {
  if (!props.competitionId) return
  loading.value = true
  isEditing.value = false
  try {
    const resp = await getCompetition(props.competitionId)
    detail.value = resp.competition
  } catch {
    // 拦截器统一弹窗
  } finally {
    loading.value = false
  }
}

async function loadVenues() {
  venueLoading.value = true
  try {
    // status=1 仅取启用场地
    venueList.value = await getVenueListApi(undefined, 1)
  } catch {
    // 降级为空列表
  } finally {
    venueLoading.value = false
  }
}

// ===== Edit handlers =====
function enterEdit() {
  if (!detail.value) return
  Object.assign(form, {
    venueId: detail.value.venueId,
    round: detail.value.round,
    groupNo: detail.value.groupNo,
    startTime: detail.value.startTime,
    endTime: detail.value.endTime,
    remark: detail.value.remark || '',
  })
  isEditing.value = true
  // 懒加载场地选项
  if (venueList.value.length === 0) {
    loadVenues()
  }
}

function cancelEdit() {
  isEditing.value = false
  formRef.value?.resetFields()
}

async function handleSave() {
  try {
    await formRef.value?.validateFields()
    saving.value = true
    const dto: CompetitionUpdateDTO = {
      venueId: form.venueId,
      round: form.round,
      groupNo: form.groupNo,
      startTime: form.startTime,
      endTime: form.endTime,
      remark: form.remark || undefined,
    }
    const updated = await updateCompetition(props.competitionId, dto)
    detail.value = updated
    message.success('保存成功')
    isEditing.value = false
  } catch (err) {
    // 校验失败或接口异常：接口异常由拦截器统一弹窗
    // eslint-disable-next-line no-console
    if (err?.errorFields) return // 表单校验错误，不弹
  } finally {
    saving.value = false
  }
}

// ===== Status flow handler =====
function handleStatusFlow(target: number) {
  const actionText = STATUS_MAP[target]
  Modal.confirm({
    title: '确认操作',
    content: `确定要将比赛状态变更为「${actionText}」吗？该操作不可逆。`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      statusUpdating.value = true
      try {
        await updateCompetitionStatus(props.competitionId, { status: target })
        message.success('状态已更新')
        // 重新拉取详情（status 流转不触父级 watch，本组件内主动刷新）
        await loadDetail()
      } finally {
        statusUpdating.value = false
      }
    },
  })
}

// ===== Watchers =====
// 父级 competitionId 变化（路由切换场次）→ 重新加载
watch(() => props.competitionId, () => {
  loadDetail()
})

// ===== Lifecycle =====
onMounted(() => {
  loadDetail()
})
</script>

<style scoped lang="less">
.basic-info-tab {
  .action-bar {
    margin-bottom: @space-md;
    min-height: 32px;
  }

  .edit-form {
    max-width: 720px;
    margin-top: @space-sm;
  }

  .form-actions {
    margin-top: @space-md;
  }
}
</style>
