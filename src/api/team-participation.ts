import request from '@/utils/request'

/** 团体参赛记录视图对象 */
export interface TeamParticipationVO {
  id: number
  collegeId: number
  collegeName: string
  eventId: number
  eventName: string
  competitionId: number | null
  participantCount: number
  status: number
  createdAt: string
  updatedAt: string
}

/** 团体参赛创建参数 */
export interface TeamParticipationCreateDTO {
  collegeId: number
  eventId: number
  participantCount: number
}

/** 团体参赛查询参数 */
export interface TeamParticipationQueryParams {
  current?: number
  size?: number
  eventId?: number
  collegeId?: number
  status?: number
  competitionId?: number
}

/** 分页结果 */
export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  size: number
  pages: number
}

/** 获取团体参赛分页列表 */
export function getTeamParticipationListApi(params: TeamParticipationQueryParams): Promise<PageResult<TeamParticipationVO>> {
  return request.get('/team-participations', { params })
}

/** 按 ID 获取团体参赛详情 */
export function getTeamParticipationByIdApi(id: number): Promise<TeamParticipationVO> {
  return request.get(`/team-participations/${id}`)
}

/** 创建团体参赛记录 */
export function createTeamParticipationApi(data: TeamParticipationCreateDTO): Promise<TeamParticipationVO> {
  return request.post('/team-participations', data)
}

/** 取消团体参赛（删除） */
export function cancelTeamParticipationApi(id: number): Promise<void> {
  return request.delete(`/team-participations/${id}`)
}

/** 团体参赛签到 */
export function checkInTeamParticipationApi(id: number): Promise<void> {
  return request.put(`/team-participations/${id}/check-in`)
}
