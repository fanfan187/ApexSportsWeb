/**
 * 排名模块 - VO 类型定义
 *
 * 与后端 Phase B 产出对齐，字段命名 camelCase。
 * 后端 VO 使用 @Getter（不可变），前端仅声明形状。
 */

/** 学院总积分排名（列表项） */
export interface CollegeRankingVO {
  collegeId: number
  collegeName: string
  collegeCode: string
  totalPoints: number
  goldCount: number
  silverCount: number
  bronzeCount: number
  individualPoints: number
  teamPoints: number
  /** 当前排名（空学院兜底为 null） */
  ranking: number | null
}

/** 学院明细中单项成绩条目 */
export interface EventScoreDetailVO {
  eventId: number
  eventName: string
  /** "个人" | "团体" */
  eventType: string
  /** 团体成绩为 null */
  athleteName: string | null
  rank: number
  /** 成绩展示文本，如 "12.34s" / "5.67m" */
  score: string
  points: number
  /** "GOLD" | "SILVER" | "BRONZE" | "NONE" */
  medalType: string
}

/** 学院积分详情（含明细列表） */
export interface CollegeScoreDetailVO extends Omit<CollegeRankingVO, 'ranking'> {
  /** 当前排名（空学院兜底为 null） */
  ranking: number | null
  eventScoreDetails: EventScoreDetailVO[]
}

/** 积分刷新结果（管理员触发） */
export interface ScoreRefreshResultVO {
  /** 刷新时间（后端 LocalDateTime 字符串） */
  refreshTime: string
  /** 受影响的学院数量 */
  affectedColleges: number
  /** 涉及比赛项目总数 */
  totalEvents: number
}
