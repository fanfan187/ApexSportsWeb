import request from '@/utils/request'

/** 记录列表视图对象 */
export interface RecordListVO {
  id: number
  eventName: string
  recordType: number
  athleteName: string
  collegeName: string
  score: number
  scoreDisplay: string
  recordDate: string
  competitionName: string
  status: number
}

/** 记录详情视图对象（在列表字段基础上扩展关�?ID 与时间戳�?*/
export interface RecordDetailVO {
  id: number
  eventId: number
  eventName: string
  recordType: number
  athleteId: number
  athleteName: string
  collegeId: number
  collegeName: string
  score: number
  scoreDisplay: string
  recordDate: string
  competitionName: string
  status: number
  createdAt: string
  updatedAt: string
}

/** 记录创建参数 */
export interface RecordCreateDTO {
  eventId: number
  recordType: number
  athleteId?: number
  collegeId?: number
  athleteName?: string
  collegeName?: string
  score: number
  scoreDisplay: string
  recordDate: string
  competitionName?: string
}

/** 记录更新参数（全部可选，按需更新�?*/
export interface RecordUpdateDTO {
  recordType?: number
  athleteName?: string
  collegeName?: string
  score?: number
  scoreDisplay?: string
  recordDate?: string
  competitionName?: string
  status?: number
}

/** 获取记录列表（支持按项目、记录类型、状态筛选） */
export function getRecordListApi(
  eventId?: number,
  recordType?: number,
  status?: number,
): Promise<RecordListVO[]> {
  return request.get('/records', { params: { eventId, recordType, status } })
}

/** �?ID 获取记录详情 */
export function getRecordByIdApi(id: number): Promise<RecordDetailVO> {
  return request.get(`/records/${id}`)
}

/** 创建记录 */
export function createRecordApi(data: RecordCreateDTO): Promise<RecordDetailVO> {
  return request.post('/records', data)
}

/** 更新记录 */
export function updateRecordApi(id: number, data: RecordUpdateDTO): Promise<RecordDetailVO> {
  return request.put(`/records/${id}`, data)
}
