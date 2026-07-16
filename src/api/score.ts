/**
 * 成绩模块 - API 封装
 *
 * 对应后端 ScoreController（7 个端点）。
 * baseURL 已含 /api 前缀（见 .env / vite.config），故此处 URL 不再重复 /api。
 *
 * 接口文档：Docs/10-成绩管理模块.md
 */
import request from '@/utils/request'
import type { PageResult } from '@/views/schedule/types'
import type {
  BatchScoreDTO,
  BatchTeamScoreDTO,
  CompetitionScoreVO,
  ScoreEntryResultVO,
  ScoreQueryDTO,
  ScoreUpdateDTO,
  ScoreVO,
  SingleScoreDTO,
} from '@/views/score/types'

// ===== 成绩录入 =====

/** 批量录入个人成绩 */
export function batchAddScores(data: BatchScoreDTO): Promise<ScoreEntryResultVO> {
  return request.post('/scores/batch', data)
}

/** 单条录入个人成绩（competitionId 由路径参数注入，见 Controller） */
export function addScore(data: SingleScoreDTO): Promise<ScoreEntryResultVO> {
  return request.post('/scores', data)
}

/** 批量录入团体成绩 */
export function batchAddTeamScores(data: BatchTeamScoreDTO): Promise<ScoreEntryResultVO> {
  return request.post('/scores/team-batch', data)
}

// ===== 成绩查询 =====

/** 分页查询成绩列表 */
export function getScorePage(params?: ScoreQueryDTO): Promise<PageResult<ScoreVO>> {
  return request.get('/scores', { params })
}

/** 获取比赛成绩汇总（按名次排序的排名列表） */
export function getCompetitionScores(competitionId: number): Promise<CompetitionScoreVO> {
  return request.get(`/scores/competition/${competitionId}`)
}

// ===== 成绩维护 =====

/** 修改成绩（按需更新，nullable 字段表示不修改） */
export function updateScore(id: number, data: ScoreUpdateDTO): Promise<ScoreVO> {
  return request.put(`/scores/${id}`, data)
}

/** 删除成绩（逻辑删除） */
export function deleteScoreById(id: number): Promise<void> {
  return request.delete(`/scores/${id}`)
}
