import request from '@/utils/request'

/** 场地视图对象 */
export interface VenueVO {
  id: number
  name: string
  code: string
  type: number
  location?: string
  capacity?: number
  status: number
  createdAt?: string
  updatedAt?: string
}

/** 场地创建参数 */
export interface VenueCreateDTO {
  name: string
  code: string
  type: number
  location?: string
  capacity?: number
}

/** 场地更新参数 */
export interface VenueUpdateDTO {
  name?: string
  code?: string
  type?: number
  location?: string
  capacity?: number
  status?: number
}

/** 场地赛程占用 */
export interface VenueScheduleVO {
  id: number
  eventName: string
  startTime: string
  endTime: string
  status: number
}

/** 获取场地列表（支持按类型和状态筛选） */
export function getVenueListApi(type?: number, status?: number): Promise<VenueVO[]> {
  return request.get('/venues', { params: { type, status } })
}

/** 按 ID 获取场地详情 */
export function getVenueByIdApi(id: number): Promise<VenueVO> {
  return request.get(`/venues/${id}`)
}

/** 创建场地 */
export function createVenueApi(data: VenueCreateDTO): Promise<VenueVO> {
  return request.post('/venues', data)
}

/** 更新场地 */
export function updateVenueApi(id: number, data: VenueUpdateDTO): Promise<VenueVO> {
  return request.put(`/venues/${id}`, data)
}

/** 删除场地 */
export function deleteVenueApi(id: number): Promise<void> {
  return request.delete(`/venues/${id}`)
}

/** 查看场地赛程占用（可按日期筛选） */
export function getVenueScheduleApi(id: number, date?: string): Promise<VenueScheduleVO[]> {
  return request.get(`/venues/${id}/schedule`, { params: { date } })
}
