import type { Member, RecFile, Task } from './types'

const p2 = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const ymOf = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
export const lastDay = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate()
export const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()) }
export const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime()
export const WD = ['일', '월', '화', '수', '목', '금', '토']
export const fmtMD = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

export function isWorkday(d: Date, holidays: Set<string>) {
  const w = d.getDay()
  return w !== 0 && w !== 6 && !holidays.has(ymd(d))
}
function nextWorkday(d: Date, h: Set<string>) {
  let x = d
  for (let i = 0; i < 15 && !isWorkday(x, h); i++) x = addDays(x, 1)
  return x
}

export interface Period { key: string; start: Date; end: Date }

/** baseMonth(해당 월 1일)에 시작하는 월간 업무 기간. 마감일이 휴일이면 다음 영업일로 */
export function periodOf(task: Task, baseMonth: Date, h: Set<string>): Period {
  const y = baseMonth.getFullYear(), m = baseMonth.getMonth()
  const from = task.from ?? 1
  const to = task.to ?? from
  const ld = lastDay(y, m)
  let start = new Date(y, m, from === -1 ? ld : Math.min(from, ld))
  let end: Date
  if (to === -1) end = new Date(y, m, ld)
  else if (from !== -1 && to < from) end = new Date(y, m + 1, Math.min(to, lastDay(y, m + 1)))
  else if (from === -1) end = new Date(y, m + 1, Math.min(to, lastDay(y, m + 1)))
  else end = new Date(y, m, Math.min(to, ld))
  const single = sameDay(start, end)
  end = nextWorkday(end, h)
  if (single) start = end
  return { key: ymOf(baseMonth), start, end }
}

export function periodCovering(task: Task, date: Date, h: Set<string>): Period | null {
  for (const k of [0, -1]) {
    const p = periodOf(task, addMonths(date, k), h)
    if (date >= p.start && date <= p.end) return p
  }
  return null
}

/** date 이전에 마감된 가장 최근 기간 */
export function lastEndedPeriod(task: Task, date: Date, h: Set<string>): Period | null {
  let best: Period | null = null
  for (const k of [0, -1, -2]) {
    const p = periodOf(task, addMonths(date, k), h)
    if (p.end < date && (!best || p.end > best.end)) best = p
  }
  return best
}

export const isDayType = (t: Task) => t.cycle === 'always' || t.cycle === 'daily' || t.cycle === 'weekly'

export function dueOnDay(t: Task, d: Date, h: Set<string>) {
  if (t.cycle === 'always' || t.cycle === 'daily') return isWorkday(d, h)
  if (t.cycle === 'weekly') return d.getDay() === (t.weekday ?? 1)
  return false
}

export const dayKey = (t: Task, d: Date) => `d|${t.id}|${ymd(d)}`
export const perKey = (t: Task, p: Period) => `p|${t.id}|${p.key}`
export const evKey = (taskId: string, siteId: string) => `e|${taskId}|${siteId}`

const dayLbl = (n: number) => (n === -1 ? '말일' : `${n}일`)
export function cycleLabel(t: Task) {
  switch (t.cycle) {
    case 'always': return '상시'
    case 'daily': return '매일'
    case 'weekly': return `매주 ${WD[t.weekday ?? 1]}요일`
    case 'event': return '신규현장 발생시'
    case 'monthly': {
      const f = t.from ?? 1, to = t.to ?? f
      if (f === to) return `매월 ${dayLbl(f)}`
      const next = (f !== -1 && to !== -1 && to < f) || f === -1
      return `매월 ${dayLbl(f)}~${next ? '익월 ' : ''}${dayLbl(to)}`
    }
  }
}

export type Recs = Record<string, RecFile>

export type CellState = 'off' | 'none' | 'done' | 'miss' | 'today' | 'todo' | 'range' | 'range-done' | 'range-miss'

/** 월간 점검표 셀 상태 */
export function cellState(t: Task, d: Date, h: Set<string>, recs: Recs, today: Date, start?: Date): CellState {
  const st = cellState0(t, d, h, recs, today)
  if (start && d < start && (st === 'miss' || st === 'range-miss')) return st === 'miss' ? 'todo' : 'range'
  return st
}
function cellState0(t: Task, d: Date, h: Set<string>, recs: Recs, today: Date): CellState {
  if (isDayType(t)) {
    if (!dueOnDay(t, d, h)) return isWorkday(d, h) ? 'none' : 'off'
    if (recs[ymOf(d)]?.[dayKey(t, d)]) return 'done'
    if (d < today) return 'miss'
    return sameDay(d, today) ? 'today' : 'todo'
  }
  if (t.cycle === 'monthly') {
    const p = periodCovering(t, d, h)
    if (!p) return isWorkday(d, h) ? 'none' : 'off'
    const r = recs[p.key]?.[perKey(t, p)]
    if (r) return ymd(new Date(r.at)) === ymd(d) ? 'done' : 'range-done'
    if (sameDay(d, p.end) && p.end < today) return 'range-miss'
    return 'range'
  }
  return 'none'
}

/** 담당자/전체 기준 월 진행률 (오늘까지 도래분) */
export function monthStats(tasks: Task[], month: Date, h: Set<string>, recs: Recs, today: Date, start?: Date) {
  let total = 0, done = 0
  const y = month.getFullYear(), m = month.getMonth()
  const lim = Math.min(lastDay(y, m), today.getMonth() === m && today.getFullYear() === y ? today.getDate() : lastDay(y, m))
  if (month > today) return { total: 0, done: 0 }
  for (const t of tasks) {
    if (isDayType(t)) {
      for (let i = 1; i <= lim; i++) {
        const d = new Date(y, m, i)
        if (start && d < start) continue
        if (!dueOnDay(t, d, h)) continue
        total++
        if (recs[ymOf(d)]?.[dayKey(t, d)]) done++
      }
    } else if (t.cycle === 'monthly') {
      const p = periodOf(t, month, h)
      if (p.start > today) continue
      if (start && p.end < start) continue
      total++
      if (recs[p.key]?.[perKey(t, p)]) done++
    }
  }
  return { total, done }
}

export function canCheck(t: Task, me: Member) {
  return me.role === 'admin' || t.owner === me.id
}

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
