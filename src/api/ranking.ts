/**
 * 排名模块 - API 封装
 *
 * 对应后端 RankingController（3 个端点）。
 * baseURL 已含 /api 前缀（见 .env / vite.config），故此处 URL 不再重复 /api。
 *
 * 接口文档：Docs/12-学院积分与排名模块.md
 */
import request from '@/utils/request'
import type {
  CollegeRankingVO,
  CollegeScoreDetailVO,
  ScoreRefreshResultVO,
} from '@/views/ranking/types'

// ===== 排名查询 =====

/** 获取学院总积分排名列表（按 ranking ASC，后端已排序） */
export function getCollegeRankings(): Promise<CollegeRankingVO[]> {
  return request.get('/rankings/colleges')
}

/** 获取某学院积分详情（含明细列表，按积分降序） */
export function getCollegeDetail(collegeId: number): Promise<CollegeScoreDetailVO> {
  return request.get(`/rankings/colleges/${collegeId}`)
}

// ===== 积分维护 =====

/** 手动刷新学院积分汇总（仅管理员） */
export function refreshCollegeScores(): Promise<ScoreRefreshResultVO> {
  return request.post('/rankings/refresh')
}
