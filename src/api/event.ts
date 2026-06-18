import request from '@/utils/request'

/** 比赛项目视图对象 */
export interface EventVO {
  id: number
  name: string
  code: string
  type: number
  category: number
  gender: number
  unit: string
  maxParticipants: number | null
  maxIndividualEvents: number
  description?: string
  status: number
  createdAt?: string
  updatedAt?: string
}

/** 比赛项目创建参数 */
export interface EventCreateDTO {
  name: string
  code: string
  type: number
  category: number
  gender: number
  unit: string
  maxParticipants?: number
  maxIndividualEvents?: number
  description?: string
  // NO status field — POST rejects it
}

/** 比赛项目更新参数 */
export interface EventUpdateDTO {
  name?: string
  code?: string
  type?: number
  category?: number
  gender?: number
  unit?: string
  maxParticipants?: number | null
  maxIndividualEvents?: number
  description?: string
  status?: number
}

/** 比赛项目查询参数 */
export interface EventQueryParams {
  type?: number
  category?: number
  gender?: number
  status?: number
}

/** 历史记录视图对象 */
export interface RecordVO {
  id: number
  recordType: number
  athleteName?: string
  collegeName?: string
  achievement?: string
  achievementDate?: string
  competitionName?: string
  createdAt?: string
}

/** 获取比赛项目列表 */
export function getEventListApi(params?: EventQueryParams): Promise<EventVO[]> {
  return request.get('/events', { params })
}

/** 按 ID 获取比赛项目 */
export function getEventByIdApi(id: number): Promise<EventVO> {
  return request.get(`/events/${id}`)
}

/** 创建比赛项目 */
export function createEventApi(data: EventCreateDTO): Promise<EventVO> {
  return request.post('/events', data)
}

/** 更新比赛项目 */
export function updateEventApi(id: number, data: EventUpdateDTO): Promise<EventVO> {
  return request.put(`/events/${id}`, data)
}

/** 删除比赛项目 */
export function deleteEventApi(id: number): Promise<void> {
  return request.delete(`/events/${id}`)
}

/** 获取项目历史记录 */
export function getEventRecordsApi(id: number, recordType?: number): Promise<RecordVO[]> {
  return request.get(`/events/${id}/records`, { params: { recordType } })
}
