/** 器材类型预设值（基于 data.sql 反推，运动会期间稳定） */
export const EQUIPMENT_TYPES = ['竞赛器材', '计时设备', '田赛器材', '测量工具', '投掷器材'] as const

/** 计量单位预设值 */
export const EQUIPMENT_UNITS = ['个', '根', '副', '把', '台', '块', '对', '卷'] as const

/** 状态映射（复用 StatusTag 的 enable 类型：0停用/1可用） */
export const EQUIPMENT_STATUS = {
  DISABLED: 0,
  AVAILABLE: 1,
} as const
