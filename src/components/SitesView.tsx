import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { canCheck, evKey, pct, uid, ymd } from '../lib/schedule'
import { Bar, Check, OwnerBadge, fmtAt, useEventApplies } from './ui'

export default function SitesView() {
  const { config, recs, me, auth, ensureFiles, setRec, saveConfig, memberName } = useStore()
  const applies = useEventApplies()
  const [name, setName] = useState('')
  const [manager, setManager] = useState('')
  const [showClosed, setShowClosed] = useState(false)
  useEffect(() => { ensureFiles(['events']) }, [ensureFiles])

  const evTasks = config.tasks.filter((t) => t.active && t.cycle === 'event').sort((a, b) => a.order - b.order)
  const ev = recs.events ?? {}
  const sites = config.sites.filter((s) => showClosed || !s.closed).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (config.sites.some((s) => s.name === n)) return alert('이미 등록된 현장입니다.')
    await saveConfig((c) => ({ ...c, sites: [...c.sites, { id: uid(), name: n, manager: manager || undefined, createdAt: ymd(new Date()) }] }), `신규현장 등록: ${n}`)
    setName('')
  }
  const patch = (id: string, p: Record<string, unknown>, msg: string) =>
    saveConfig((c) => ({ ...c, sites: c.sites.map((s) => (s.id === id ? { ...s, ...p } : s)) }), msg)
  const remove = (id: string, n: string) => {
    if (!confirm(`'${n}' 현장을 삭제할까요? (체크 기록은 남지만 화면에서 사라집니다)`)) return
    saveConfig((c) => ({ ...c, sites: c.sites.filter((s) => s.id !== id) }), `현장 삭제: ${n}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="card flex flex-wrap items-end gap-2 p-3">
        <label className="min-w-56 flex-1"><div className="lbl mb-1">신규현장 이름</div>
          <input className="inp w-full" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="현장명 입력" /></label>
        <label><div className="lbl mb-1">담당자 (담당 현장 업무 대상)</div>
          <select className="inp" value={manager} onChange={(e) => setManager(e.target.value)}>
            <option value="">전원</option>
            {auth.members.filter((m) => m.role !== 'admin').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select></label>
        <button className="btn-amber py-1.5" onClick={add}>현장 등록</button>
        <label className="ml-auto flex items-center gap-1 text-[12px] text-slate-500"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />종료 현장 보기</label>
      </div>

      {!sites.length && <div className="card p-8 text-center text-slate-400">등록된 신규현장이 없습니다. 현장이 생기면 위에서 등록하세요.</div>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sites.map((s) => {
          const list = evTasks.filter((t) => applies(t, s))
          const done = list.filter((t) => ev[evKey(t.id, s.id)]).length
          return (
            <div key={s.id} className={`card p-3 ${s.closed ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold text-navy">{s.name}</div>
                  <div className="text-[11px] text-slate-400">등록 {s.createdAt} · 담당 {s.manager ? memberName(s.manager) : '전원'}</div>
                </div>
                <span className="text-[12px] font-bold text-amber">{done}/{list.length}</span>
              </div>
              <Bar value={pct(done, list.length)} className="my-2" />
              {list.map((t) => {
                const r = ev[evKey(t.id, s.id)]
                return (
                  <div key={t.id} className="flex items-center gap-2 border-b border-slate-100 py-1.5 last:border-0">
                    <Check on={!!r} disabled={!canCheck(t, me)} onClick={() => setRec('events', evKey(t.id, s.id), !r, `${t.title} [${s.name}]`)} />
                    <span className={`min-w-0 flex-1 truncate text-[12px] ${r ? 'text-slate-400 line-through' : ''}`}>{t.title}</span>
                    {r && <span className="text-[10px] text-slate-400">{fmtAt(r.at)}</span>}
                    <OwnerBadge id={t.owner} />
                  </div>
                )
              })}
              {me.role === 'admin' && (
                <div className="mt-2 flex justify-end gap-1.5">
                  <select className="inp py-0.5 text-[11px]" value={s.manager ?? ''} onChange={(e) => patch(s.id, { manager: e.target.value || undefined }, `현장 담당 변경: ${s.name}`)}>
                    <option value="">담당: 전원</option>
                    {auth.members.filter((m) => m.role !== 'admin').map((m) => <option key={m.id} value={m.id}>담당: {m.name}</option>)}
                  </select>
                  <button className="btn" onClick={() => patch(s.id, { closed: !s.closed }, `현장 ${s.closed ? '재개' : '종료'}: ${s.name}`)}>{s.closed ? '재개' : '종료 처리'}</button>
                  <button className="btn text-red-600" onClick={() => remove(s.id, s.name)}>삭제</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
