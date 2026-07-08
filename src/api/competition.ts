/**
 * 赛程安排模块 - API 封装
 *
 * 对应后端 CompetitionController（18 个端点）。
 * baseURL 已含 /api 前缀（见 .env / vite.config），故此处 URL 不再重复 /api。
 *
 * 接口文档：Docs/09-赛程安排模块.md（接口 53-70）
 */
import request from '@/utils/request'
import type {
  AssignEquipmentDTO,
  AssignRefereeDTO,
  BatchArrangeDTO,
  BatchTeamArrangeDTO,
  Competition,
  CompetitionCreateDTO,
  CompetitionDetail,
  CompetitionEquipment,
  CompetitionQueryDTO,
  CompetitionUpdateDTO,
  PageResult,
  ParticipantArrangement,
  RefereeAssignment,
  ScheduleBooklet,
  TeamParticipantArrangement,
  UpdateCompetitionStatusDTO,
  UpdateEquipmentStatusDTO,
} from '@/views/schedule/types'

// ===== 场次 CRUD =====

/** 创建比赛场次（接口 53） */
export function createCompetition(data: CompetitionCreateDTO): Promise<Competition> {
  return request.post('/competitions', data)
}

/** 分页查询赛程列表（接口 54） */
export function getCompetitions(params?: CompetitionQueryDTO): Promise<PageResult<Competition>> {
  return request.get('/competitions', { params })
}

/** 获取比赛场次详情（含裁判/器材/参赛者，接口 55） */
export function getCompetition(id: number): Promise<CompetitionDetail> {
  return request.get(`/competitions/${id}`)
}

/** 修改比赛场次（接口 56） */
export function updateCompetition(id: number, data: CompetitionUpdateDTO): Promise<Competition> {
  return request.put(`/competitions/${id}`, data)
}

/** 删除比赛场次（逻辑删除，接口 57） */
export function deleteCompetition(id: number): Promise<void> {
  return request.delete(`/competitions/${id}`)
}

/** 比赛状态流转（仅正向流转，接口 58） */
export function updateCompetitionStatus(
  id: number,
  data: UpdateCompetitionStatusDTO,
): Promise<void> {
  return request.put(`/competitions/${id}/status`, data)
}

// ===== 秩序册 =====

/** 获取完整秩序册（接口 70，可选日期筛选） */
export function getBooklet(date?: string): Promise<ScheduleBooklet[]> {
  return request.get('/competitions/booklet', { params: { date } })
}

// ===== 个人编排 =====

/** 批量编排运动员到场次（接口 59） */
export function arrangeParticipants(
  id: number,
  data: BatchArrangeDTO,
): Promise<ParticipantArrangement[]> {
  return request.post(`/competitions/${id}/participants`, data)
}

/** 获取场次参赛运动员列表（接口 60） */
export function getParticipants(id: number): Promise<ParticipantArrangement[]> {
  return request.get(`/competitions/${id}/participants`)
}

/** 移除运动员编排（接口 61） */
export function removeParticipant(id: number, participationId: number): Promise<void> {
  return request.delete(`/competitions/${id}/participants/${participationId}`)
}

// ===== 团体编排 =====

/** 批量编排团体到场次（接口 62） */
export function arrangeTeamParticipants(
  id: number,
  data: BatchTeamArrangeDTO,
): Promise<TeamParticipantArrangement[]> {
  return request.post(`/competitions/${id}/team-participants`, data)
}

/** 移除团体编排（接口 63） */
export function removeTeamParticipant(id: number, teamParticipationId: number): Promise<void> {
  return request.delete(`/competitions/${id}/team-participants/${teamParticipationId}`)
}

// ===== 裁判分配 =====

/** 分配裁判（接口 64） */
export function assignReferee(id: number, data: AssignRefereeDTO): Promise<RefereeAssignment> {
  return request.post(`/competitions/${id}/referee-assignments`, data)
}

/** 获取裁判分配列表（接口 65） */
export function getRefereeAssignments(id: number): Promise<RefereeAssignment[]> {
  return request.get(`/competitions/${id}/referee-assignments`)
}

/** 移除裁判分配（接口 66） */
export function removeRefereeAssignment(id: number, assignmentId: number): Promise<void> {
  return request.delete(`/competitions/${id}/referee-assignments/${assignmentId}`)
}

// ===== 器材分配 =====

/** 分配器材（接口 67，同步扣减库存） */
export function assignEquipment(id: number, data: AssignEquipmentDTO): Promise<CompetitionEquipment> {
  return request.post(`/competitions/${id}/equipments`, data)
}

/** 获取器材使用列表（接口 68） */
export function getEquipments(id: number): Promise<CompetitionEquipment[]> {
  return request.get(`/competitions/${id}/equipments`)
}

/** 更新器材状态/归还（接口 69，归还时恢复库存） */
export function updateEquipmentStatus(
  id: number,
  recordId: number,
  data: UpdateEquipmentStatusDTO,
): Promise<void> {
  return request.put(`/competitions/${id}/equipments/${recordId}`, data)
}
