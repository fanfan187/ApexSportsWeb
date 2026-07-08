<template>
  <div class="booklet-page">
    <!-- 顶部工具栏（打印时隐藏） -->
    <div class="booklet-toolbar">
      <a-space wrap>
        <a-radio-group v-model:value="dateMode" @change="handleModeChange">
          <a-radio-button value="all">全部</a-radio-button>
          <a-radio-button value="date">按日期</a-radio-button>
        </a-radio-group>
        <a-date-picker
          v-if="dateMode === 'date'"
          v-model:value="selectedDate"
          placeholder="选择日期"
          allowClear
          style="width: 180px"
        />
        <a-button type="primary" @click="fetchData">查询</a-button>
        <a-button @click="handlePrint">打印</a-button>
      </a-space>
    </div>

    <!-- 标题（打印时展示） -->
    <div class="booklet-title">
      <h2>比赛秩序册</h2>
      <div v-if="dateMode === 'date' && selectedDate" class="booklet-subtitle">
        {{ selectedDate.format('YYYY年MM月DD日') }}
      </div>
      <div v-else class="booklet-subtitle">全部赛程</div>
    </div>

    <!-- 数据表格 -->
    <a-table
      :columns="columns"
      :data-source="dataList"
      :loading="loading"
      row-key="id"
      :pagination="false"
      size="middle"
      :scroll="{ x: 1400 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'eventName'">
          <span class="event-name">{{ (record as ScheduleBooklet).eventName }}</span>
        </template>
        <template v-if="column.key === 'eventType'">
          {{ EVENT_TYPE_MAP[(record as ScheduleBooklet).eventType] || '-' }}
        </template>
        <template v-if="column.key === 'eventCategory'">
          {{ EVENT_CATEGORY_MAP[(record as ScheduleBooklet).eventCategory] || '-' }}
        </template>
        <template v-if="column.key === 'round'">
          {{ ROUND_MAP[(record as ScheduleBooklet).round] || '-' }}
        </template>
        <template v-if="column.key === 'startTime'">
          {{ formatTime((record as ScheduleBooklet).startTime) }}
        </template>
        <template v-if="column.key === 'endTime'">
          {{ formatTime((record as ScheduleBooklet).endTime) }}
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="STATUS_COLOR_MAP[(record as ScheduleBooklet).status] || 'default'">
            {{ STATUS_MAP[(record as ScheduleBooklet).status] || '-' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'chiefReferee'">
          {{ (record as ScheduleBooklet).chiefReferee || '-' }}
        </template>
      </template>

      <!-- 空数据 -->
      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无赛程数据" />
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Empty, type TableColumnsType } from 'ant-design-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { getBooklet } from '@/api/competition'
import type { ScheduleBooklet } from './types'
import {
  STATUS_MAP,
  STATUS_COLOR_MAP,
  ROUND_MAP,
  EVENT_TYPE_MAP,
  EVENT_CATEGORY_MAP,
} from './constants'

// === 数据状态 ===
const loading = ref(false)
const dataList = ref<ScheduleBooklet[]>([])

// === 筛选状态 ===
const dateMode = ref<'all' | 'date'>('all')
const selectedDate = ref<Dayjs | null>(null)

// === 表格列定义 ===
const columns: TableColumnsType = [
  { title: '项目名称', key: 'eventName', dataIndex: 'eventName', width: 180, fixed: 'left' },
  { title: '类型', key: 'eventType', dataIndex: 'eventType', width: 80 },
  { title: '类别', key: 'eventCategory', dataIndex: 'eventCategory', width: 80 },
  { title: '场地', key: 'venueName', dataIndex: 'venueName', width: 120 },
  { title: '轮次', key: 'round', dataIndex: 'round', width: 80 },
  { title: '组别', key: 'groupNo', dataIndex: 'groupNo', width: 70 },
  { title: '开始时间', key: 'startTime', dataIndex: 'startTime', width: 150 },
  { title: '结束时间', key: 'endTime', dataIndex: 'endTime', width: 150 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 90 },
  { title: '参赛人数', key: 'participantCount', dataIndex: 'participantCount', width: 90 },
  { title: '主裁判', key: 'chiefReferee', dataIndex: 'chiefReferee', width: 100 },
]

// === 数据加载 ===
async function fetchData() {
  loading.value = true
  try {
    // 不选日期（全部）：传 undefined，让 axios 忽略该参数
    // 选具体日期：传 'YYYY-MM-DD' 字符串
    const dateParam =
      dateMode.value === 'date' && selectedDate.value
        ? selectedDate.value.format('YYYY-MM-DD')
        : undefined
    dataList.value = await getBooklet(dateParam)
  } finally {
    loading.value = false
  }
}

// === 模式切换：切到"全部"时清空已选日期 ===
function handleModeChange() {
  if (dateMode.value === 'all') {
    selectedDate.value = null
  }
}

// === 打印 ===
function handlePrint() {
  window.print()
}

// === 时间格式化 ===
function formatTime(value: string): string {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
}

// === 生命周期 ===
onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="less">
.booklet-page {
  .booklet-toolbar {
    margin-bottom: @space-md;
  }

  .booklet-title {
    margin-bottom: @space-md;
    text-align: center;

    h2 {
      font-size: @font-size-h1;
      font-weight: 600;
      color: @text-color;
    }

    .booklet-subtitle {
      margin-top: @space-xs;
      font-size: @font-size-sm;
      color: @text-secondary;
    }
  }

  .event-name {
    font-weight: 500;
  }
}

// ===== 打印样式 =====
@media print {
  // 隐藏工具栏
  .booklet-toolbar {
    display: none !important;
  }

  // 标题强化
  .booklet-title {
    h2 {
      font-size: 22px;
    }
  }

  // 表格全宽展开，去掉装饰
  .booklet-page {
    .ant-table-wrapper {
      box-shadow: none !important;
    }

    .ant-table {
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    .ant-table-container {
      overflow: visible !important;
    }

    // 表格滚动解除，便于打印全部列
    .ant-table-content {
      overflow: visible !important;
    }

    // 分页器隐藏
    .ant-pagination {
      display: none !important;
    }
  }

  // 强制打印背景色（保证 Tag 颜色可见）
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
