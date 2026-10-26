export type CycleType = 'always' | 'daily' | 'weekly' | 'monthly' | 'event'

export interface Task {
  id: string
  title: string
  owner: string // member id
  cycle: CycleType
  weekday?: number // 0(일)~6(토), weekly
  from?: number // monthly 시작일 (-1 = 말일)
  to?: number // monthly 종료일 (-1 = 말일, from보다 작으면 익월)
  note?: string
  active: boolean
  order: number
}

export interface Site {
  id: string
  name: string
  manager?: string // member id (비우면 전원 대상)
  createdAt: string
  closed?: boolean
}

export interface Config {
  version: 1
  tasks: Task[]
  sites: Site[]
  holidays: string[] // YYYY-MM-DD
  startDate?: string // 사용 시작일 — 이전 날짜는 지연/누락으로 보지 않음
  updatedAt?: string
}

export interface Member {
  id: string
  name: string
  role: 'admin' | 'user'
  salt?: string
  iv?: string
  wrapped?: string // 비밀번호로 암호화된 데이터키
}

/** public/auth.json — 공개 파일. 토큰은 암호화된 상태로만 들어 있음 */
export interface AuthFile {
  version: 1
  owner: string
  appRepo: string
  dataRepo: string
  branch: string
  authPath: string
  dataDir: string
  tokenIv: string
  tokenCt: string
  members: Member[]
}

export interface Rec { by: string; at: string }
export type RecFile = Record<string, Rec>

export interface Session { memberId: string; token: string; dataKey: string }
