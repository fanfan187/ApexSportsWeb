// ApexSports QA — API client (C0 harness)
// No axios/lodash — fetch is global in Node 18+ / Bun, and we keep the
// surface tiny so every module spec (C2-C14) shares one client.
//
// Contract reference: Docs/01-认证与用户模块.md
//   POST /api/auth/login { username, password } -> { code, message, data: { token, userInfo } }
//   All authenticated routes expect `Authorization: Bearer <token>`.

export const API_BASE = 'http://localhost:8080/api'

export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly path: string,
    message: string,
  ) {
    super(`API ${path} failed: code=${code} message=${message}`)
    this.name = 'ApiError'
  }
}

function authHeaders(token?: string): Record<string, string> {
  const t = token ?? process.env.QA_TOKEN ?? ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (t) headers['Authorization'] = `Bearer ${t}`
  return headers
}

async function send<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<ApiResult<T>> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    method,
    headers: authHeaders(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  // Some delete endpoints return 204 with empty body — guard parse.
  const text = await res.text()
  if (!text) {
    return { code: res.status, message: res.statusText, data: undefined as T }
  }
  let parsed: ApiResult<T>
  try {
    parsed = JSON.parse(text) as ApiResult<T>
  } catch {
    throw new ApiError(res.status, path, `non-JSON response: ${text.slice(0, 200)}`)
  }
  return parsed
}

/**
 * Logs in via the auth API and returns the JWT token string. Throws if the
 * response shape deviates from the documented contract.
 */
export async function apiLogin(
  username: string = 'admin',
  password: string = 'admin123',
): Promise<string> {
  const res = await send<{ token: string; userInfo: unknown }>(
    'POST',
    '/auth/login',
    { username, password },
  )
  if (res.code !== 200 || !res.data?.token) {
    throw new ApiError(res.code, '/auth/login', res.message)
  }
  return res.data.token
}

export const apiGet = <T = unknown>(path: string, token?: string) =>
  send<T>('GET', path, undefined, token)

export const apiPost = <T = unknown>(path: string, body?: unknown, token?: string) =>
  send<T>('POST', path, body, token)

export const apiPut = <T = unknown>(path: string, body?: unknown, token?: string) =>
  send<T>('PUT', path, body, token)

export const apiDelete = <T = unknown>(path: string, token?: string) =>
  send<T>('DELETE', path, undefined, token)

/**
 * Lists records via `listPath`, filters those whose `name`/`code` field
 * (extracted by `extractIdFn` -> wait, extractIdFn returns the id; the
 * filter predicate uses `prefix` against the record's name or code) starts
 * with `prefix`, then deletes each by id via `deletePathFn(id)`. Returns
 * the count of records deleted.
 *
 * Used by afterAll in every module spec to guarantee __qa_* test data is
 * cleaned up even if a spec crashes mid-run.
 */
export async function cleanupByPrefix(
  listPath: string,
  extractIdFn: (record: Record<string, unknown>) => string | number | undefined,
  deletePathFn: (id: string | number) => string,
  prefix: string,
  token?: string,
): Promise<number> {
  const res = await apiGet<unknown[] | { records?: unknown[]; list?: unknown[] }>(
    listPath,
    token,
  )
  if (res.code !== 200) return 0
  const records: Record<string, unknown>[] = Array.isArray(res.data)
    ? (res.data as Record<string, unknown>[])
    : ((res.data?.records ?? res.data?.list ?? []) as Record<string, unknown>[])
  let deleted = 0
  for (const record of records) {
    const name = String(record.name ?? record.code ?? '')
    if (!name.startsWith(prefix)) continue
    const id = extractIdFn(record)
    if (id === undefined) continue
    const delRes = await apiDelete(deletePathFn(id), token)
    if (delRes.code === 200) deleted += 1
  }
  return deleted
}
