/**
 * 首页看板模块 - API 封装
 *
 * 对应后端 DashboardController（3 个端点）。
 * baseURL 已含 /api 前缀（见 .env / vite.config），故此处 URL 不再重复 /api。
 *
 * 接口文档：Docs/13-统计与看板模块.md §85/§86/§87
 */
import request from '@/utils/request'
import type {
  OverviewVO,
  TodayScheduleVO,
  BreakingRecordsVO,
} from '@/views/dashboard/types'

/** 获取首页概览数据（接口85） */
export function getDashboardOverview(): Promise<OverviewVO> {
  return request.get('/dashboard/overview')
}

/** 获取今日赛程（接口86） */
export function getTodaySchedule(): Promise<TodayScheduleVO> {
  return request.get('/dashboard/today-schedule')
}

/** 获取破纪录汇总（接口87） */
export function getBreakingRecords(): Promise<BreakingRecordsVO> {
  return request.get('/dashboard/breaking-records')
}
