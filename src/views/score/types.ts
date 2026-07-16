/**
 * 成绩模块 - 类型定义
 *
 * 字段来源：Docs/10-成绩管理模块.md + 后端 VO/DTO 定义
 * 命名约定：camelCase（与后端 JSON 序列化一致）
 *
 * 注意：PageResult<T> 已在 @/views/schedule/types 定义，本模块不重复定义，
 * 由 api/score.ts 直接从 @/views/schedule/types 导入复用。
 */

// ===== VO 类型（响应数据） =====

/** 成绩视图对象（列表项） */
export interface ScoreVO {
  id: number
  /** 个人参赛记录 ID（个人成绩非空，团体成绩为 null） */
  participationId: number | null
  /** 团体参赛记录 ID（团体成绩非空，个人成绩为 null） */
  teamParticipationId: number | null
  /** 运动员姓名（团体成绩为 null） */
  athleteName: string | null
  /** 学院名称（个人/团体成绩均有） */
  collegeName: string
  /** 项目名称 */
  eventName: string
  /** 比赛场次名称 */
  competitionName: string
  /** 名次 */
  rank: number
  /** 积分 */
  points: number
  /** 成绩数值（径赛为秒数，田赛为米/厘米） */
  scoreValue: number
  /** 成绩展示文本（如 "12.34s" / "5.67m"） */
  scoreDisplay: string
  /** 是否破纪录：0-否, 1-是（列表标志位，与后端 Integer 对齐） */
  isRecordBreaking: number
  createdAt: string
}

/** 成绩详情视图对象（含破纪录关联 ID，分页/详情通用） */
export interface ScoreDetailVO extends ScoreVO {
  /** 破纪录记录 ID（isRecordBreaking=0 时为 null） */
  recordId: number | null
}

/** 团体成绩视图对象（无个人字段） */
export interface TeamScoreVO {
  id: number
  teamParticipationId: number
  collegeName: string
  eventName: string
  competitionName: string
  rank: number
  points: number
  scoreValue: number
  scoreDisplay: string
  /** 是否破纪录：0-否, 1-是 */
  isRecordBreaking: number
  createdAt: string
}

/** 排名列表项（CompetitionScoreVO.rankings 元素，无 createdAt） */
export interface ScoreItemVO {
  id: number
  participationId: number | null
  teamParticipationId: number | null
  athleteName: string | null
  collegeName: string
  rank: number
  points: number
  scoreValue: number
  scoreDisplay: string
  /** 是否破纪录：0-否, 1-是 */
  isRecordBreaking: number
}

/** 比赛成绩汇总视图（按名次排序的排名列表） */
export interface CompetitionScoreVO {
  competitionId: number
  competitionName: string
  eventName: string
  /** 按名次排序的排名列表 */
  rankings: ScoreItemVO[]
  /** 该比赛总成绩记录数 */
  totalRecords: number
}

/** 成绩录入结果视图（批量/单条录入响应） */
export interface ScoreEntryResultVO {
  /** 本次录入是否触发破纪录（语义「本次是否破纪录」，使用 boolean 而非 0/1） */
  isRecordBreaking: boolean
  /** 成功录入条数 */
  successCount: number
}

// ===== DTO 类型（请求数据） =====

/** 批量录入个人成绩 - 单条成绩项 */
export interface ScoreItemDTO {
  participationId: number
  /** 名次，≥1 */
  rank: number
  /** 成绩数值 */
  scoreValue: number
  /** 成绩展示文本 */
  scoreDisplay: string
}

/** 批量录入个人成绩 */
export interface BatchScoreDTO {
  competitionId: number
  items: ScoreItemDTO[]
}

/** 单条录入个人成绩（competitionId 由路径参数注入，不进 DTO） */
export interface SingleScoreDTO {
  participationId: number
  /** 名次，≥1 */
  rank: number
  /** 积分，可选（null 时由后端按 rank 自动计算） */
  points?: number
  scoreValue: number
  scoreDisplay: string
}

/** 批量录入团体成绩 - 单条成绩项 */
export interface TeamScoreItemDTO {
  teamParticipationId: number
  rank: number
  scoreValue: number
  scoreDisplay: string
}

/** 批量录入团体成绩 */
export interface BatchTeamScoreDTO {
  competitionId: number
  items: TeamScoreItemDTO[]
}

/** 修改成绩参数（全可选，按需更新；id 由路径参数注入） */
export interface ScoreUpdateDTO {
  rank?: number
  points?: number
  scoreValue?: number
  scoreDisplay?: string
}

/** 成绩分页查询参数 */
export interface ScoreQueryDTO {
  /** 页码，默认 1 */
  page?: number
  /** 每页条数，默认 10 */
  size?: number
  competitionId?: number
  eventId?: number
}
