import request from '@/utils/request'

/** 运动员视图对象 */
export interface AthleteVO {
  id: number
  collegeId: number
  collegeName: string
  collegeCode?: string
  name: string
  studentNo: string
  gender: number
  grade?: string
  phone?: string
  status: number
  createdAt?: string
  updatedAt?: string
}

/** 运动员创建参数 */
export interface AthleteCreateDTO {
  collegeId: number
  name: string
  studentNo: string
  gender: number
  grade?: string
  phone?: string
}

/** 运动员更新参数 */
export interface AthleteUpdateDTO {
  collegeId?: number
  name?: string
  studentNo?: string
  gender?: number
  grade?: string
  phone?: string
  status?: number
}

/** 运动员查询参数 */
export interface AthleteQueryParams {
  current?: number
  size?: number
  collegeId?: number
  name?: string
  studentNo?: string
  status?: number
  gender?: number
}

/** 分页结果 */
export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  size: number
  pages: number
}

/** 获取运动员分页列表 */
export function getAthleteListApi(params: AthleteQueryParams): Promise<PageResult<AthleteVO>> {
  return request.get('/athletes', { params })
}

/** 按 ID 获取运动员详情 */
export function getAthleteByIdApi(id: number): Promise<AthleteVO> {
  return request.get(`/athletes/${id}`)
}

/** 创建运动员 */
export function createAthleteApi(data: AthleteCreateDTO): Promise<AthleteVO> {
  return request.post('/athletes', data)
}

/** 更新运动员 */
export function updateAthleteApi(id: number, data: AthleteUpdateDTO): Promise<AthleteVO> {
  return request.put(`/athletes/${id}`, data)
}

/** 删除运动员 */
export function deleteAthleteApi(id: number): Promise<void> {
  return request.delete(`/athletes/${id}`)
}
