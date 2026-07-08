/**
 * 赛程安排模块 - 类型定义
 *
 * 字段来源：Docs/09-赛程安排模块.md + 后端 VO/DTO 定义
 * 命名约定：camelCase（与后端 JSON 序列化一致）
 */

// ===== 分页结果 =====

/** 分页结果（与后端 IPage 结构对齐） */
export interface PageResult<T> {
  /** 数据列表 */
  records: T[]
  /** 总记录数 */
  total: number
  /** 当前页码 */
  current: number
  /** 每页条数 */
  size: number
  /** 总页数 */
  pages: number
}

// ===== VO 类型（响应数据） =====

/** 比赛场次视图对象 */
export interface Competition {
  id: number
  eventId: number
  eventName: string
  /** 项目类型：1-个人, 2-集体 */
  eventType: number
  /** 项目类别：1-径赛, 2-田赛 */
  eventCategory: number
  venueId: number
  venueName: string
  /** 轮次：1-预赛, 2-决赛 */
  round: number
  /** 组别 */
  groupNo: number
  startTime: string
  endTime: string
  /** 比赛状态：0-未开始, 1-进行中, 2-已结束, 3-已取消 */
  status: number
  remark?: string | null
  createdAt?: string
}

/** 裁判分配视图对象 */
export interface RefereeAssignment {
  id: number
  competitionId: number
  refereeId: number
  refereeName: string
  /** 职务：1-主裁判, 2-副裁判, 3-计时员, 4-记录员 */
  role: number
  /** 分配状态 */
  status: number
  createdAt?: string
}

/** 器材使用视图对象 */
export interface CompetitionEquipment {
  id: number
  competitionId: number
  equipmentId: number
  equipmentName: string
  quantity: number
  /** 分配状态：0-已分配, 1-使用中, 2-已归还 */
  status: number
  remark?: string | null
  createdAt?: string
}

/** 参赛者编排视图对象（个人项目） */
export interface ParticipantArrangement {
  participationId: number
  athleteId: number
  athleteName: string
  studentNo?: string
  collegeId?: number
  collegeName?: string
  /** 道次 */
  laneNo?: number | null
  /** 号码牌 */
  bibNumber?: string | null
  /** 参赛状态 */
  status?: number
}

/** 团体参赛编排视图对象（集体项目） */
export interface TeamParticipantArrangement {
  teamParticipationId: number
  collegeId: number
  collegeName: string
  eventId: number
  /** 参赛人数 */
  participantCount: number
  /** 参赛状态 */
  status?: number
}

/** 比赛场次详情（聚合视图） */
export interface CompetitionDetail {
  /** 比赛场次基本信息 */
  competition: Competition
  /** 裁判分配列表 */
  refereeAssignments: RefereeAssignment[]
  /** 器材使用列表 */
  equipmentAssignments: CompetitionEquipment[]
  /** 参赛者编排列表（个人项目） */
  participantArrangements: ParticipantArrangement[]
  /** 团体参赛编排列表（集体项目） */
  teamParticipantArrangements: TeamParticipantArrangement[]
}

/** 秩序册条目 */
export interface ScheduleBooklet {
  id: number
  eventName: string
  eventType: number
  eventCategory: number
  venueName: string
  round: number
  groupNo: number
  startTime: string
  endTime: string
  status: number
  /** 已编排参赛者人数 */
  participantCount: number
  /** 主裁判姓名（未分配则 null） */
  chiefReferee: string | null
}

// ===== DTO 类型（请求数据） =====

/** 创建比赛场次参数 */
export interface CompetitionCreateDTO {
  eventId: number
  venueId: number
  /** 轮次：1-预赛, 2-决赛 */
  round: number
  /** 组别，默认 1 */
  groupNo?: number
  /** ISO 8601 字符串，如 2026-05-15T08:00:00 */
  startTime: string
  endTime: string
  /** 备注，最大 500 字符 */
  remark?: string
}

/** 修改比赛场次参数（全可选，按需更新） */
export interface CompetitionUpdateDTO {
  eventId?: number
  venueId?: number
  round?: number
  groupNo?: number
  startTime?: string
  endTime?: string
  remark?: string
}

/** 赛程列表查询参数 */
export interface CompetitionQueryDTO {
  /** 页码，默认 1 */
  current?: number
  /** 每页条数，默认 10，最大 100 */
  size?: number
  /** 日期筛选（YYYY-MM-DD） */
  date?: string
  venueId?: number
  eventId?: number
  /** 状态筛选：0-未开始, 1-进行中, 2-已结束, 3-已取消 */
  status?: number
  /** 轮次筛选 */
  round?: number
}

/** 批量编排运动员到场次 - 单条编排项 */
export interface ArrangeItem {
  participationId: number
  /** 道次 */
  laneNo?: number
  /** 号码牌 */
  bibNumber?: string
}

/** 批量编排运动员到场次 */
export interface BatchArrangeDTO {
  participants: ArrangeItem[]
}

/** 批量编排团体到场次 - 单条编排项 */
export interface TeamArrangeItem {
  teamParticipationId: number
}

/** 批量编排团体到场次 */
export interface BatchTeamArrangeDTO {
  teamParticipants: TeamArrangeItem[]
}

/** 分配裁判参数 */
export interface AssignRefereeDTO {
  refereeId: number
  /** 职务：1-主裁判, 2-副裁判, 3-计时员, 4-记录员 */
  role: number
}

/** 分配器材参数 */
export interface AssignEquipmentDTO {
  equipmentId: number
  /** 使用数量，≥1 */
  quantity: number
  remark?: string
}

/** 更新器材状态（归还）参数 */
export interface UpdateEquipmentStatusDTO {
  /** 目标状态：1-使用中, 2-已归还 */
  status: number
}

/** 比赛状态流转参数 */
export interface UpdateCompetitionStatusDTO {
  /** 目标状态：0-未开始, 1-进行中, 2-已结束, 3-已取消 */
  status: number
}
