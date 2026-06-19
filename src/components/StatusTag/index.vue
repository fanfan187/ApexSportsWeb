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
    | 'venueType'
    | 'userRole'
    | 'round'
    | 'recordType'
    | 'refereeRole'
    | 'competitionStatus'
    | 'refereeStatus'
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
  // 场地类型（1-径赛/2-田赛/3-综合）
  venueType: {
    1: { color: 'blue', text: '径赛场地' },
    2: { color: 'green', text: '田赛场地' },
    3: { color: 'purple', text: '综合场地' },
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
  // (12) 裁判职务（as_referee_assignment.role 1-4）
  refereeRole: {
    1: { color: 'red', text: '主裁判' },
    2: { color: 'orange', text: '副裁判' },
    3: { color: 'blue', text: '计时员' },
    4: { color: 'green', text: '记录员' },
  },
  // (13) 比赛状态（as_competition.status 0-3，独立于 competition 的字符串兼容版本）
  competitionStatus: {
    0: { color: 'default', text: '未开始' },
    1: { color: 'processing', text: '进行中' },
    2: { color: 'success', text: '已结束' },
    3: { color: 'error', text: '已取消' },
  },
  // (14) 裁判状态（as_referee.status 0-1，主列表用）
  refereeStatus: {
    0: { color: 'default', text: '休息' },
    1: { color: 'success', text: '可用' },
  },
}

const tagConfig = computed(() => {
  const map = statusMaps[props.type] || {}
  return map[props.status] || { color: 'default', text: String(props.status) }
})
</script>