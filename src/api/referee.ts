import request from '@/utils/request'
import type { PageResult } from '@/api/athlete'

/** 裁判视图对象 */
export interface RefereeVO {
  id: number
  name: string
  gender: number
  phone?: string
  level?: string
  status: number
  createdAt?: string
  updatedAt?: string
}

/** 裁判创建参数 */
export interface RefereeCreateDTO {
  name: string
  gender: number
  phone?: string
  level?: string
}

/** 裁判更新参数 */
export interface RefereeUpdateDTO {
  name?: string
  gender?: number
  phone?: string
  level?: string
  status?: number
}

/** 裁判查询参数 */
export interface RefereeQueryParams {
  current?: number
  size?: number
  level?: string
  status?: number
  keyword?: string
}

/** 裁判赛程视图对象 */
export interface RefereeScheduleVO {
  competitionId: number
  eventName: string
  scheduleTime?: string
  startTime?: string
  endTime?: string
  venueName: string
  role: number
  competitionStatus: number
}

/** 获取裁判分页列表 */
export function getRefereeListApi(params: RefereeQueryParams): Promise<PageResult<RefereeVO>> {
  return request.get('/referees', { params })
}

/** 按 ID 获取裁判详情 */
export function getRefereeByIdApi(id: number): Promise<RefereeVO> {
  return request.get(`/referees/${id}`)
}

/** 创建裁判 */
export function createRefereeApi(data: RefereeCreateDTO): Promise<RefereeVO> {
  return request.post('/referees', data)
}

/** 更新裁判 */
export function updateRefereeApi(id: number, data: RefereeUpdateDTO): Promise<RefereeVO> {
  return request.put(`/referees/${id}`, data)
}

/** 删除裁判 */
export function deleteRefereeApi(id: number): Promise<void> {
  return request.delete(`/referees/${id}`)
}

/** 获取裁判赛程安排 */
export function getRefereeScheduleApi(id: number): Promise<RefereeScheduleVO[]> {
  return request.get(`/referees/${id}/schedule`)
}
