/**
 * 赛程安排模块 - 常量映射
 *
 * 与后端 CompetitionConstants 对齐，用于前端状态标签、颜色、文案渲染。
 */

// ===== 比赛状态 =====

/** 比赛状态值 */
export const COMPETITION_STATUS = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  FINISHED: 2,
  CANCELLED: 3,
} as const

/** 比赛状态文案映射 */
export const STATUS_MAP: Record<number, string> = {
  0: '未开始',
  1: '进行中',
  2: '已结束',
  3: '已取消',
}

/** 比赛状态颜色映射（Ant Design Badge / Tag status） */
export const STATUS_COLOR_MAP: Record<number, string> = {
  0: 'default',
  1: 'processing',
  2: 'success',
  3: 'error',
}

// ===== 轮次 =====

/** 轮次文案映射 */
export const ROUND_MAP: Record<number, string> = {
  1: '预赛',
  2: '决赛',
}

// ===== 裁判角色 =====

/** 裁判角色值 */
export const REFEREE_ROLE = {
  CHIEF: 1,
  DEPUTY: 2,
  TIMER: 3,
  RECORDER: 4,
} as const

/** 裁判角色文案映射 */
export const REFEREE_ROLE_MAP: Record<number, string> = {
  1: '主裁判',
  2: '副裁判',
  3: '计时员',
  4: '记录员',
}

// ===== 器材使用状态 =====

/** 器材使用状态值 */
export const EQUIPMENT_USE_STATUS = {
  ASSIGNED: 0,
  IN_USE: 1,
  RETURNED: 2,
} as const

/** 器材使用状态文案映射 */
export const EQUIPMENT_STATUS_MAP: Record<number, string> = {
  0: '已分配',
  1: '使用中',
  2: '已归还',
}

/** 器材使用状态颜色映射 */
export const EQUIPMENT_STATUS_COLOR_MAP: Record<number, string> = {
  0: 'default',
  1: 'processing',
  2: 'success',
}

// ===== 项目类型 / 类别（只读映射，辅助渲染） =====

/** 项目类型文案映射：1-个人, 2-集体 */
export const EVENT_TYPE_MAP: Record<number, string> = {
  1: '个人',
  2: '集体',
}

/** 项目类别文案映射：1-径赛, 2-田赛 */
export const EVENT_CATEGORY_MAP: Record<number, string> = {
  1: '径赛',
  2: '田赛',
}
