/**
 * 排名模块 - 常量映射
 *
 * 奖牌文案/配色直接复用 score 模块（与后端 ScoreConstants 对齐），
 * 此处仅补充本项目独有的 eventType 文案/配色映射。
 */
export {
  MEDAL,
  MEDAL_MAP,
  MEDAL_LABEL_MAP,
  MEDAL_COLOR_MAP,
} from '@/views/score/constants'

// ===== 项目类型（个人 / 团体，与后端 EventConstants 对齐） =====

/** 项目类型 -> 中文文案映射 */
export const EVENT_TYPE_LABEL: Record<string, string> = {
  个人: '个人',
  团体: '团体',
}

/** 项目类型 -> Ant Design Tag color 映射 */
export const EVENT_TYPE_COLOR: Record<string, string> = {
  个人: 'blue',
  团体: 'purple',
}
