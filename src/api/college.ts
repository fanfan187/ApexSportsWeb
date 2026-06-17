import request from '@/utils/request'

/** 学院视图对象 */
export interface CollegeVO {
  id: number
  name: string
  code: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

/** 学院创建参数 */
export interface CollegeCreateDTO {
  name: string
  code: string
  description?: string
}

/** 学院更新参数 */
export interface CollegeUpdateDTO {
  name?: string
  code?: string
  description?: string
}

/** 获取学院列表 */
export function getCollegeListApi(): Promise<CollegeVO[]> {
  return request.get('/colleges')
}

/** 按 ID 获取学院 */
export function getCollegeByIdApi(id: number): Promise<CollegeVO> {
  return request.get(`/colleges/${id}`)
}

/** 创建学院 */
export function createCollegeApi(data: CollegeCreateDTO): Promise<CollegeVO> {
  return request.post('/colleges', data)
}

/** 更新学院 */
export function updateCollegeApi(id: number, data: CollegeUpdateDTO): Promise<CollegeVO> {
  return request.put(`/colleges/${id}`, data)
}

/** 删除学院 */
export function deleteCollegeApi(id: number): Promise<void> {
  return request.delete(`/colleges/${id}`)
}
