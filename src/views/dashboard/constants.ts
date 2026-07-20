/**
 * 首页看板模块 - 常量映射
 *
 * 与后端 DashboardConstants 对齐，用于状态标签、颜色、文案渲染。
 */

// ===== 今日赛程比赛状态（后端返回 String 枚举） =====

/** 比赛状态文案映射 */
export const COMPETITION_STATUS_MAP: Record<string, string> = {
  PENDING: '未开始',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
}

/** 比赛状态颜色映射（Ant Design Tag color） */
export const COMPETITION_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
}

// ===== 纪录类型 =====

/** 纪录类型颜色映射（Ant Design Tag color） */
export const RECORD_TYPE_TAG: Record<string, string> = {
  校记录: 'blue',
  市记录: 'purple',
  省记录: 'red',
}
