import request from '@/utils/request'

export interface LoginParams {
  username: string
  password: string
}

export interface UserInfo {
  id: number
  username: string
  realName: string
  role: number // 0=工作人员, 1=管理员
}

export interface LoginResult {
  token: string
  userInfo: UserInfo
}

/** 用户登录 */
export function loginApi(params: LoginParams): Promise<LoginResult> {
  return request.post('/auth/login', params)
}

/** 用户登出 */
export function logoutApi(): Promise<void> {
  return request.post('/auth/logout')
}

/** 修改密码 */
export function changePasswordApi(
  id: number,
  data: { oldPassword: string; newPassword: string },
): Promise<void> {
  return request.put(`/users/${id}/password`, data)
}