import request from '@/utils/request'

/** 器材视图对象 */
export interface EquipmentVO {
  id: number
  name: string
  code: string
  type: string | null
  unit: string
  totalQuantity: number
  availableQuantity: number
  status: number
  createdAt: string
  updatedAt: string
}

/** 器材创建参数 */
export interface EquipmentCreateDTO {
  name: string
  code: string
  type?: string
  unit: string
  totalQuantity: number
  // 不含 status 和 availableQuantity（后端业务规则）
}

/** 器材更新参数 */
export interface EquipmentUpdateDTO {
  name?: string
  code?: string
  type?: string
  unit?: string
  totalQuantity?: number
  status?: number
  // 不含 availableQuantity（只能通过 totalQuantity 联动）
}

/** 获取器材列表（支持按类型和状态筛选） */
export function getEquipmentListApi(type?: string, status?: number): Promise<EquipmentVO[]> {
  return request.get('/equipments', { params: { type, status } })
}

/** 按 ID 获取器材详情 */
export function getEquipmentByIdApi(id: number): Promise<EquipmentVO> {
  return request.get(`/equipments/${id}`)
}

/** 创建器材 */
export function createEquipmentApi(data: EquipmentCreateDTO): Promise<EquipmentVO> {
  return request.post('/equipments', data)
}

/** 更新器材 */
export function updateEquipmentApi(id: number, data: EquipmentUpdateDTO): Promise<EquipmentVO> {
  return request.put(`/equipments/${id}`, data)
}

/** 删除器材 */
export function deleteEquipmentApi(id: number): Promise<void> {
  return request.delete(`/equipments/${id}`)
}
