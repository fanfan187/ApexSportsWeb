/**
 * 首页看板模块 - 类型定义
 *
 * 字段来源：Docs/13-统计与看板模块.md §85/§86/§87 + 后端 VO
 * 命名约定：camelCase（与后端 JSON 序列化一致）
 */

// ===== 接口85：首页概览 =====

/** 首页概览数据（接口85） */
export interface OverviewVO {
  /** 总运动员数 */
  totalAthletes: number
  /** 参赛学院数 */
  totalColleges: number
  /** 比赛项目数 */
  totalEvents: number
  /** 总报名人次（含已取消） */
  totalRegistrations: number
  /** 已完成比赛场次数 */
  completedCompetitions: number
  /** 总比赛场次数 */
  totalCompetitions: number
  /** 赛程进度百分比字符串，如 "35.4%" */
  scheduleProgress: string
  /** 本届破纪录总数 */
  recordBreakCount: number
  /** 今日比赛场次数 */
  todayCompetitions: number
}

// ===== 接口86：今日赛程 =====

/** 今日赛程单项（接口86 competitions[]） */
export interface TodayScheduleItem {
  /** 比赛场次ID */
  competitionId: number
  /** 项目名称 */
  eventName: string
  /** 场地名称 */
  venueName: string
  /** 开始时间（HH:mm） */
  startTime: string
  /** 结束时间（HH:mm，未结束为 null） */
  endTime: string | null
  /** 参赛者数量 */
  participantCount: number
  /** 主裁判姓名（未分配为 null） */
  chiefRefereeName: string | null
  /** 比赛状态：PENDING | IN_PROGRESS | COMPLETED */
  status: string
  /** 组别号 */
  groupNumber: number
}

/** 今日赛程（接口86） */
export interface TodayScheduleVO {
  /** 当日日期（yyyy-MM-dd） */
  date: string
  /** 今日比赛总场次数 */
  totalCompetitions: number
  /** 比赛场次列表（按开始时间升序） */
  competitions: TodayScheduleItem[]
}

// ===== 接口87：破纪录汇总 =====

/** 破纪录单项（接口87 records[]） */
export interface BreakingRecordItem {
  /** 记录ID */
  id: number
  /** 项目名称 */
  eventName: string
  /** 运动员姓名（个人项目；团体项目为 null） */
  athleteName: string | null
  /** 学院名称 */
  collegeName: string
  /** 新纪录成绩显示 */
  newScoreDisplay: string
  /** 原纪录成绩显示（首次设立为 null） */
  oldScoreDisplay: string | null
  /** 纪录类型：校记录 | 市记录 | 省记录 */
  recordType: string
  /** 破纪录日期（yyyy-MM-dd） */
  breakDate: string
}

/** 破纪录汇总（接口87） */
export interface BreakingRecordsVO {
  /** 破纪录总数 */
  totalCount: number
  /** 破纪录详情列表（按 breakDate 降序） */
  records: BreakingRecordItem[]
}
