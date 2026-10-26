import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import {
  WD, addDays, addMonths, canCheck, cycleLabel, dayKey, dueOnDay, evKey, fmtMD, isWorkday, lastEndedPeriod,
  monthStats, parseYmd, pct, perKey, periodCovering, periodOf, sameDay, today0, ymOf, ymd, type Period,
} from '../lib/schedule'
import type { Task } from '../lib/types'
import { Bar, Check, OwnerBadge, OwnerFilter, fmtAt, useEventApplies } from './ui'

interface Item { task: Task; file: string; key: string; label: string; sub?: string; dday?: string; urgent?: boolean; checkable: boolean }

export default function TodayView() {
  const { config, recs, holidays, startD, me, ensureFiles, setRec, memberName, auth } = useStore()
  const [date, setDate] = useState(today0())
  const [owner, setOwner] = useState(me.role === 'admin' ? 'all' : me.id)
  const today = today0()
  const applies = useEventApplies()

  useEffect(() => {
    ensureFiles([ymOf(date), ymOf(addMonths(date, -1)), ymOf(addMonths(date, -2)), 'events', ymOf(today), ymOf(addMonths(today, -1))])
  }, [date, ensureFiles])

  const tasks = useMemo(() => config.tasks.filter((t) => t.active && (owner === 'all' || t.owner === owner)).sort((a, b) => a.order - b.order), [config.tasks, owner])
  const future = date > today

  const sec = useMemo(() => {
    const period: Item[] = [], overdue: Item[] = [], weekly: Item[] = [], daily: Item[] = [], events: Item[] = []
    const mkPer = (t: Task, p: Period, late: boolean): Item => {
      const left = Math.round((p.end.getTime() - date.getTime()) / 86400000)
      return {
        task: t, file: p.key, key: perKey(t, p), label: `${t.title} (${p.key.slice(5)}월분)`,
        sub: `${fmtMD(p.start)}${sameDay(p.start, p.end) ? '' : ` ~ ${fmtMD(p.end)}`}`,
        dday: late ? `${-left}일 지연` : left === 0 ? '오늘 마감' : `D-${left}`, urgent: late || left <= 1, checkable: !future,
      }
    }
    for (const t of tasks) {
      if (t.cycle === 'monthly') {
        const p = periodCovering(t, date, holidays)
        if (p) period.push(mkPer(t, p, false))
        const lp = lastEndedPeriod(t, date, holidays)
        if (lp && !recs[lp.key]?.[perKey(t, lp)] && (!p || p.key !== lp.key) && date.getTime() - lp.end.getTime() < 45 * 86400000 && (!startD || lp.end >= startD))
          overdue.push(mkPer(t, lp, true))
      } else if (t.cycle === 'weekly' || t.cycle === 'always' || t.cycle === 'daily') {
        if (!dueOnDay(t, date, holidays)) continue
        const it: Item = { task: t, file: ymOf(date), key: dayKey(t, date), label: t.title, checkable: !future }
        ;(t.cycle === 'weekly' ? weekly : daily).push(it)
      } else if (t.cycle === 'event') {
        for (const s of config.sites.filter((s) => !s.closed)) {
          if (!applies(t, s)) continue
          events.push({ task: t, file: 'events', key: evKey(t.id, s.id), label: t.title, sub: s.name, checkable: true })
        }
      }
    }
    period.sort((a, b) => (a.dday ?? '').localeCompare(b.dday ?? ''))
    return { period, overdue, weekly, daily, events }
  }, [tasks, date, holidays, startD, recs, config.sites, future, applies])

  const isDone = (it: Item) => recs[it.file]?.[it.key]
  const dueItems = [...sec.period, ...sec.weekly, ...sec.daily]
  const doneCnt = dueItems.filter(isDone).length
  const ms = monthStats(tasks, new Date(date.getFullYear(), date.getMonth(), 1), holidays, recs, today, startD)

  const upcoming = useMemo(() => {
    const out: { t: Task; p: Period }[] = []
    for (const t of tasks.filter((t) => t.cycle === 'monthly')) {
      for (const k of [0, 1]) {
        const p = periodOf(t, addMonths(date, k), holidays)
        if (p.start > date && p.start <= addDays(date, 10)) out.push({ t, p })
      }
    }
    return out.sort((a, b) => a.p.start.getTime() - b.p.start.getTime())
  }, [tasks, date, holidays])

  const perMember = auth.members.map((m) => {
    const its = dueItems.filter((i) => i.task.owner === m.id)
    return { m, n: its.length, d: its.filter(isDone).length }
  })

  const toggle = (it: Item) => setRec(it.file, it.key, !isDone(it), `${it.label}${it.sub && it.file === 'events' ? ` [${it.sub}]` : ''}`)

  const row = (it: Item) => {
    const r = isDone(it)
    const allowed = it.checkable && canCheck(it.task, me)
    return (
      <div key={it.key} className={`group flex items-center gap-2.5 border-b border-slate-100 px-1 py-1.5 last:border-0 ${r ? 'opacity-60' : ''}`}>
        <Check on={!!r} disabled={!allowed} onClick={() => toggle(it)} title={allowed ? '' : future ? '미래 날짜는 체크할 수 없습니다' : '본인 업무만 체크할 수 있습니다'} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[13px] ${r ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{it.label}</div>
          {(it.sub || it.task.note) && <div className="truncate text-[11px] text-slate-400">{[it.sub, it.task.note].filter(Boolean).join(' · ')}</div>}
        </div>
        {r && <span className="hidden text-[10px] text-slate-400 sm:inline">{memberName(r.by)} {fmtAt(r.at)}</span>}
        {it.dday && !r && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${it.urgent ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{it.dday}</span>}
        {owner === 'all' && <OwnerBadge id={it.task.owner} />}
      </div>
    )
  }

  const section = (title: string, items: Item[], tone?: 'red') => (
    <div className={`card p-3 ${tone === 'red' ? 'border-red-200 bg-red-50/40' : ''}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <div className={`text-[13px] font-bold ${tone === 'red' ? 'text-red-700' : 'text-navy'}`}>{title}</div>
        <div className="text-[11px] text-slate-400">{`${items.filter(isDone).length}/${items.length}`}</div>
      </div>
      {items.length ? items.map(row) : <div className="py-3 text-center text-[12px] text-slate-400">해당 업무 없음</div>}
    </div>
  )

  const wk = !isWorkday(date, holidays)

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm">
          <button className="btn border-0" onClick={() => setDate(addDays(date, -1))}>◀</button>
          <input type="date" className="inp border-0 text-[13px] font-semibold" value={ymd(date)} onChange={(e) => e.target.value && setDate(parseYmd(e.target.value))} />
          <span className={`text-[13px] font-semibold ${date.getDay() === 0 ? 'text-red-500' : date.getDay() === 6 ? 'text-sky-600' : 'text-slate-600'}`}>({WD[date.getDay()]})</span>
          <button className="btn border-0" onClick={() => setDate(addDays(date, 1))}>▶</button>
          {!sameDay(date, today) && <button className="btn-amber ml-1" onClick={() => setDate(today)}>오늘</button>}
        </div>
        <OwnerFilter value={owner} onChange={setOwner} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {wk && <div className="card border-sky-200 bg-sky-50 p-3 text-[12px] text-sky-800">휴무일입니다. 상시 업무는 표시되지 않습니다.</div>}
          {sec.overdue.length > 0 && section('지연된 월간 업무', sec.overdue, 'red')}
          {section('기간 업무 (월간)', sec.period)}
          {sec.weekly.length > 0 && section('주간 업무', sec.weekly)}
          {section('상시 업무', sec.daily)}
          {sec.events.length > 0 && section('신규현장 업무', sec.events)}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-navy p-4 text-white">
            <div className="text-[11px] text-slate-400">{ymd(date)} 진행률</div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-3xl font-bold text-amber">{pct(doneCnt, dueItems.length)}%</span>
              <span className="pb-1 text-[12px] text-slate-400">{doneCnt} / {dueItems.length}건</span>
            </div>
            <Bar value={pct(doneCnt, dueItems.length)} className="mt-2 bg-navy-3" />
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span>{date.getMonth() + 1}월 누적 (오늘까지)</span>
              <span className="font-semibold text-white">{pct(ms.done, ms.total)}% · {ms.done}/{ms.total}</span>
            </div>
          </div>

          {owner === 'all' && (
            <div className="card p-3">
              <div className="mb-2 text-[13px] font-bold text-navy">담당자별</div>
              {perMember.filter((x) => x.n).map(({ m, n, d }) => (
                <div key={m.id} className="mb-2">
                  <div className="mb-1 flex justify-between text-[12px]"><span>{m.name}</span><span className="text-slate-500">{d}/{n}</span></div>
                  <Bar value={pct(d, n)} />
                </div>
              ))}
            </div>
          )}

          <div className="card p-3">
            <div className="mb-1.5 text-[13px] font-bold text-navy">다가오는 기간 업무 <span className="font-normal text-slate-400">(10일 이내)</span></div>
            {upcoming.length ? upcoming.map(({ t, p }) => (
              <div key={t.id + p.key} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-[12px] last:border-0">
                <span className="w-16 shrink-0 font-semibold text-amber">{fmtMD(p.start)}{sameDay(p.start, p.end) ? '' : '~'}</span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-[10px] text-slate-400">{cycleLabel(t)}</span>
              </div>
            )) : <div className="py-2 text-center text-[12px] text-slate-400">없음</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
