/**
 * 成绩模块 - 常量映射
 *
 * 与后端 ScoreConstants 对齐，用于前端名次积分、奖牌、破纪录标签渲染。
 */

// ===== 名次积分（与后端 ScoreConstants.RANK_POINTS_MAP 一致） =====

/** 名次 -> 积分 映射（仅 1-6 名有积分） */
export const RANK_POINTS_MAP: Record<number, number> = {
  1: 10,
  2: 8,
  3: 6,
  4: 4,
  5: 2,
  6: 1,
}

// ===== 奖牌（与后端 ScoreConstants.MEDAL_MAP 一致） =====

/** 奖牌标识值 */
export const MEDAL = {
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  BRONZE: 'BRONZE',
  NONE: 'NONE',
} as const

/** 名次 -> 奖牌标识 映射（仅 1/2/3 名） */
export const MEDAL_MAP: Record<number, string> = {
  1: 'GOLD',
  2: 'SILVER',
  3: 'BRONZE',
}

/** 奖牌标识 -> 中文文案 映射 */
export const MEDAL_LABEL_MAP: Record<string, string> = {
  GOLD: '金牌',
  SILVER: '银牌',
  BRONZE: '铜牌',
  NONE: '—',
}

/** 奖牌标识 -> Ant Design Tag color 映射 */
export const MEDAL_COLOR_MAP: Record<string, string> = {
  GOLD: 'gold',
  SILVER: 'default',
  BRONZE: 'orange',
  NONE: 'default',
}

// ===== 破纪录标志位（列表 isRecordBreaking: 0/1） =====

/** 破纪录标志值 */
export const IS_RECORD_BREAKING = {
  NO: 0,
  YES: 1,
} as const

/** 破纪录标志 -> 文案映射 */
export const IS_RECORD_BREAKING_MAP: Record<number, string> = {
  0: '正常',
  1: '破纪录',
}

/** 破纪录标志 -> Ant Design Tag color 映射 */
export const IS_RECORD_BREAKING_COLOR_MAP: Record<number, string> = {
  0: 'default',
  1: 'red',
}

/** 破纪录展示标签文案 */
export const RECORD_LABEL = '破纪录'

// ===== 纪录类型（与后端 ScoreConstants.RECORD_TYPE_SCHOOL 一致） =====

/** 纪录类型值 */
export const RECORD_TYPE = {
  SCHOOL: 1,
} as const

/** 纪录类型 -> 文案映射 */
export const RECORD_TYPE_MAP: Record<number, string> = {
  1: '校记录',
}

// ===== 成绩方向（径赛/田赛，与后端 ScoreConstants 对齐） =====

/** 成绩方向值 */
export const SCORE_DIRECTION = {
  /** 径赛：越小越优（如短跑用时） */
  TRACK: 1,
  /** 田赛：越大越优（如跳远距离） */
  FIELD: 2,
} as const

/** 成绩方向 -> 文案映射 */
export const SCORE_DIRECTION_MAP: Record<number, string> = {
  1: '径赛',
  2: '田赛',
}
