import request from '@/utils/request'

/** 个人参赛记录视图对象 */
export interface ParticipationVO {
  id: number
  athleteId: number
  athleteName: string
  studentNo: string
  collegeId: number
  collegeName: string
  eventId: number
  eventName: string
  competitionId: number | null
  laneNo: number | null
  bibNumber: string | null
  status: number
  createdAt: string
  updatedAt: string
}

/** 个人参赛创建参数 */
export interface ParticipationCreateDTO {
  athleteId: number
  eventId: number
}

/** 个人参赛查询参数 */
export interface ParticipationQueryParams {
  current?: number
  size?: number
  eventId?: number
  collegeId?: number
  athleteId?: number
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

/** 获取个人参赛分页列表 */
export function getParticipationListApi(params: ParticipationQueryParams): Promise<PageResult<ParticipationVO>> {
  return request.get('/participations', { params })
}

/** 按 ID 获取个人参赛详情 */
export function getParticipationByIdApi(id: number): Promise<ParticipationVO> {
  return request.get(`/participations/${id}`)
}

/** 创建个人参赛记录 */
export function createParticipationApi(data: ParticipationCreateDTO): Promise<ParticipationVO> {
  return request.post('/participations', data)
}

/** 取消个人参赛（删除） */
export function cancelParticipationApi(id: number): Promise<void> {
  return request.delete(`/participations/${id}`)
}

/** 个人参赛签到 */
export function checkInParticipationApi(id: number): Promise<void> {
  return request.put(`/participations/${id}/check-in`)
}
