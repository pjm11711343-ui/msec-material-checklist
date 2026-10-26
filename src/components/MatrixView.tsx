import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../lib/store'
import {
  WD, addMonths, canCheck, cellState, cycleLabel, dayKey, isDayType, isWorkday, lastDay, monthStats, pct, perKey,
  periodCovering, sameDay, today0, ymOf, type CellState,
} from '../lib/schedule'
import type { Task } from '../lib/types'
import { OwnerFilter } from './ui'

const CELL: Record<CellState, { cls: string; txt: string }> = {
  off: { cls: 'bg-slate-100', txt: '' },
  none: { cls: '', txt: '' },
  done: { cls: 'bg-amber text-navy font-bold', txt: '●' },
  miss: { cls: 'bg-red-50 text-red-500', txt: '○' },
  today: { cls: 'ring-2 ring-inset ring-amber text-slate-400', txt: '·' },
  todo: { cls: 'text-slate-300', txt: '·' },
  range: { cls: 'bg-amber-soft', txt: '' },
  'range-done': { cls: 'bg-amber-soft/60 text-amber', txt: '' },
  'range-miss': { cls: 'bg-red-100 text-red-600 font-bold', txt: '○' },
}

export default function MatrixView() {
  const { config, recs, holidays, startD, me, auth, ensureFiles, setRec } = useStore()
  const today = today0()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [owner, setOwner] = useState(me.role === 'admin' ? 'all' : me.id)

  useEffect(() => { ensureFiles([ymOf(month), ymOf(addMonths(month, -1))]) }, [month, ensureFiles])

  const y = month.getFullYear(), m = month.getMonth()
  const days = Array.from({ length: lastDay(y, m) }, (_, i) => new Date(y, m, i + 1))
  const tasks = useMemo(() => config.tasks.filter((t) => t.active && t.cycle !== 'event' && (owner === 'all' || t.owner === owner)).sort((a, b) => a.order - b.order), [config.tasks, owner])
  const groups = auth.members.map((mb) => ({ mb, list: tasks.filter((t) => t.owner === mb.id) })).filter((g) => g.list.length)
  const orphan = tasks.filter((t) => !auth.members.some((mb) => mb.id === t.owner))
  if (orphan.length) groups.push({ mb: { id: '?', name: '담당자 없음', role: 'user' }, list: orphan })
  const total = monthStats(tasks, month, holidays, recs, today, startD)
  const evCount = config.tasks.filter((t) => t.active && t.cycle === 'event' && (owner === 'all' || t.owner === owner)).length

  const rowStat = (t: Task) => {
    const s = monthStats([t], month, holidays, recs, today, startD)
    return `${s.done}/${s.total}`
  }

  const click = (t: Task, d: Date) => {
    if (!canCheck(t, me) || d > today) return
    if (isDayType(t)) {
      const st = cellState(t, d, holidays, recs, today, startD)
      if (st === 'off' || st === 'none') return
      setRec(ymOf(d), dayKey(t, d), st !== 'done', `${t.title} ${d.getMonth() + 1}/${d.getDate()}`)
    } else {
      const p = periodCovering(t, d, holidays)
      if (!p) return
      const on = !recs[p.key]?.[perKey(t, p)]
      setRec(p.key, perKey(t, p), on, `${t.title} (${p.key}월분)`)
    }
  }

  const exportXlsx = () => {
    const header = ['담당자', '업무', '주기', ...days.map((d) => `${d.getDate()}(${WD[d.getDay()]})`), '완료/대상']
    const rows: (string | number)[][] = [header]
    for (const g of groups) for (const t of g.list) {
      rows.push([g.mb.name, t.title, cycleLabel(t), ...days.map((d) => {
        const st = cellState(t, d, holidays, recs, today, startD)
        return st === 'done' ? '●' : st === 'miss' || st === 'range-miss' ? '○' : st === 'range' || st === 'range-done' ? '-' : ''
      }), rowStat(t)])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 14 }, ...days.map(() => ({ wch: 4 })), { wch: 9 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${y}-${m + 1}월`)
    XLSX.writeFile(wb, `자재부_월간점검표_${ymOf(month)}.xlsx`)
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm">
          <button className="btn border-0" onClick={() => setMonth(addMonths(month, -1))}>◀</button>
          <span className="px-2 text-[14px] font-bold text-navy">{y}년 {m + 1}월</span>
          <button className="btn border-0" onClick={() => setMonth(addMonths(month, 1))}>▶</button>
        </div>
        <OwnerFilter value={owner} onChange={setOwner} />
        <div className="ml-auto flex gap-1.5">
          <button className="btn" onClick={exportXlsx}>엑셀 내려받기</button>
          <button className="btn" onClick={() => window.print()}>인쇄</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 px-3 py-2 text-[11px] text-slate-500">
          <span className="text-[13px] font-bold text-navy">자재부 월간 업무 점검표 · {y}년 {m + 1}월</span>
          <span>진행률 <b className="text-amber">{pct(total.done, total.total)}%</b> ({total.done}/{total.total})</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-amber" />완료</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-red-100" />누락</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-amber-soft" />월간업무 기간</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-slate-100" />휴무</span>
          {evCount > 0 && <span className="text-slate-400">신규현장 업무 {evCount}건은 '신규현장' 화면에서 관리</span>}
        </div>
        <div className="print-full overflow-x-auto">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed', minWidth: 300 + days.length * 24 }}>
            <colgroup><col style={{ width: 230 }} />{days.map((d) => <col key={d.getDate()} />)}<col style={{ width: 48 }} /></colgroup>
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">업무</th>
                {days.map((d) => (
                  <th key={d.getDate()} className={`border-b border-slate-200 py-1 font-normal ${sameDay(d, today) ? 'bg-amber text-navy font-bold' : d.getDay() === 0 ? 'text-red-500' : d.getDay() === 6 ? 'text-sky-600' : 'text-slate-500'}`}>
                    <div>{d.getDate()}</div><div className="text-[9px]">{WD[d.getDay()]}</div>
                  </th>
                ))}
                <th className="border-b border-l border-slate-200 font-semibold">완료</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => [
                <tr key={`h-${g.mb.id}`}><td colSpan={days.length + 2} className="sticky left-0 bg-navy px-2 py-1 text-[11px] font-bold text-amber">{g.mb.name}</td></tr>,
                ...g.list.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="sticky left-0 z-10 truncate border-b border-r border-slate-200 bg-white px-2 py-1" title={`${t.title} · ${cycleLabel(t)}`}>
                      <span className="text-slate-800">{t.title}</span>
                      <span className="ml-1 text-[10px] text-slate-400">{cycleLabel(t)}</span>
                    </td>
                    {days.map((d) => {
                      const st = cellState(t, d, holidays, recs, today, startD)
                      const c = CELL[st]
                      const clickable = canCheck(t, me) && d <= today && st !== 'off' && st !== 'none'
                      return (
                        <td key={d.getDate()} onClick={() => clickable && click(t, d)}
                          className={`h-6 border-b border-slate-100 text-center ${!isWorkday(d, holidays) && st === 'none' ? 'bg-slate-100' : ''} ${c.cls} ${clickable ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-amber' : ''}`}>
                          {c.txt}
                        </td>
                      )
                    })}
                    <td className="border-b border-l border-slate-200 text-center text-slate-600">{rowStat(t)}</td>
                  </tr>
                )),
              ])}
              {!groups.length && <tr><td colSpan={days.length + 2} className="py-6 text-center text-slate-400">표시할 업무가 없습니다</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="no-print text-[11px] text-slate-400">칸을 누르면 체크/해제됩니다. 월간 업무는 기간 안의 아무 칸이나 누르면 그 달 업무가 완료 처리됩니다 (완료한 날짜에 ●).</p>
    </div>
  )
}
