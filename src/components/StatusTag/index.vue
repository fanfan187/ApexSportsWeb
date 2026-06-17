<template>
  <a-tag :color="tagConfig.color">{{ tagConfig.text }}</a-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: number | string
  type:
    | 'competition'
    | 'participation'
    | 'enable'
    | 'equipment'
    | 'record'
    | 'gender'
    | 'eventType'
    | 'eventCategory'
    | 'userRole'
    | 'round'
    | 'recordType'
}>()

// 设计文档 5.4 节完整状态色映射
const statusMaps: Record<string, Record<string | number, { color: string; text: string }>> = {
  // (1) 比赛状态（支持 Integer 0-3 和仪表盘字符串 PENDING/IN_PROGRESS/COMPLETED）
  competition: {
    0: { color: 'default', text: '未开始' },
    1: { color: 'blue', text: '进行中' },
    2: { color: 'green', text: '已结束' },
    3: { color: 'red', text: '已取消' },
    PENDING: { color: 'default', text: '未开始' },
    IN_PROGRESS: { color: 'blue', text: '进行中' },
    COMPLETED: { color: 'green', text: '已结束' },
  },
  // (2) 报名/参赛状态
  participation: {
    0: { color: 'default', text: '已报名' },
    1: { color: 'blue', text: '检录通过' },
    2: { color: 'green', text: '已参赛' },
    3: { color: 'orange', text: '弃权' },
    4: { color: 'red', text: '取消资格' },
  },
  // (3) 通用启用/禁用
  enable: {
    0: { color: 'red', text: '禁用' },
    1: { color: 'green', text: '启用' },
  },
  // (4) 器材分配状态
  equipment: {
    0: { color: 'default', text: '已分配' },
    1: { color: 'blue', text: '使用中' },
    2: { color: 'green', text: '已归还' },
  },
  // (5) 记录状态
  record: {
    0: { color: 'red', text: '已作废' },
    1: { color: 'green', text: '有效' },
  },
  // (8) 性别
  gender: {
    0: { color: 'pink', text: '女' },
    1: { color: 'blue', text: '男' },
    2: { color: 'purple', text: '混合' },
  },
  // (8) 项目类型
  eventType: {
    1: { color: 'orange', text: '个人项目' },
    2: { color: 'cyan', text: '集体项目' },
  },
  // (8) 项目类别（径赛/田赛）
  eventCategory: {
    1: { color: 'blue', text: '径赛' },
    2: { color: 'green', text: '田赛' },
  },
  // (9) 用户角色
  userRole: {
    0: { color: 'default', text: '工作人员' },
    1: { color: 'purple', text: '管理员' },
  },
  // (10) 赛程轮次
  round: {
    1: { color: 'default', text: '预赛' },
    2: { color: 'blue', text: '决赛' },
  },
  // (11) 记录类型
  recordType: {
    1: { color: 'blue', text: '校记录' },
    2: { color: 'purple', text: '市记录' },
    3: { color: 'gold', text: '省记录' },
  },
}

const tagConfig = computed(() => {
  const map = statusMaps[props.type] || {}
  return map[props.status] || { color: 'default', text: String(props.status) }
})
</script>