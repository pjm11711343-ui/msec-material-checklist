import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../lib/store'
import { WD, cycleLabel, uid } from '../lib/schedule'
import type { CycleType, Task } from '../lib/types'

const CYCLES: { v: CycleType; l: string }[] = [
  { v: 'always', l: '상시' }, { v: 'daily', l: '매일' }, { v: 'weekly', l: '매주' }, { v: 'monthly', l: '매월' }, { v: 'event', l: '신규현장' },
]
const cycleFromKo = (s: string): CycleType | null => CYCLES.find((c) => c.l === s.trim())?.v ?? null
const dayToKo = (n?: number) => (n === undefined ? '' : n === -1 ? '말일' : n)
const dayFromKo = (v: unknown): number | undefined => {
  const s = String(v ?? '').trim().replace('일', '')
  if (!s) return undefined
  if (s === '말') return -1
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : undefined
}

export default function TasksAdmin() {
  const { config, auth, saveConfig, memberName } = useStore()
  const [draft, setDraft] = useState<Task[]>(() => structuredClone(config.tasks).sort((a, b) => a.order - b.order))
  const [owner, setOwner] = useState('all')
  const [q, setQ] = useState('')
  const [moveFrom, setMoveFrom] = useState('')
  const [moveTo, setMoveTo] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify([...config.tasks].sort((a, b) => a.order - b.order)), [draft, config.tasks])
  const view = draft.filter((t) => (owner === 'all' || t.owner === owner) && (!q || t.title.includes(q)))

  const upd = (id: string, p: Partial<Task>) => setDraft((d) => d.map((t) => {
    if (t.id !== id) return t
    const n = { ...t, ...p }
    if (p.cycle) {
      if (p.cycle === 'weekly' && n.weekday === undefined) n.weekday = 1
      if (p.cycle === 'monthly' && n.from === undefined) { n.from = 1; n.to = 1 }
    }
    return n
  }))
  const addRow = () => {
    const o = owner === 'all' ? auth.members[0]?.id ?? 'lead' : owner
    const order = Math.max(0, ...draft.map((t) => t.order)) + 1
    setDraft((d) => [...d, { id: uid(), title: '새 업무', owner: o, cycle: 'always', active: true, order }])
  }
  const delRow = (t: Task) => { if (confirm(`'${t.title}' 업무를 삭제할까요?\n(지난 체크 기록은 저장소에 남습니다. 잠시 빼려면 '사용' 체크를 해제하세요.)`)) setDraft((d) => d.filter((x) => x.id !== t.id)) }
  const move = (t: Task, dir: -1 | 1) => {
    const list = [...draft].sort((a, b) => a.order - b.order)
    const i = list.findIndex((x) => x.id === t.id), j = i + dir
    if (j < 0 || j >= list.length) return
    const [a, b] = [list[i].order, list[j].order]
    setDraft((d) => d.map((x) => (x.id === list[i].id ? { ...x, order: b } : x.id === list[j].id ? { ...x, order: a } : x)).sort((p, q) => p.order - q.order))
  }

  const transfer = () => {
    if (!moveTo) return alert('이관받을 담당자를 선택하세요.')
    const targets = sel.size ? draft.filter((t) => sel.has(t.id)) : draft.filter((t) => t.owner === moveFrom)
    if (!targets.length) return alert('이관할 업무가 없습니다. 업무를 선택하거나 이관할 담당자를 고르세요.')
    if (!confirm(`${targets.length}건을 ${memberName(moveTo)}에게 이관합니다. (저장을 눌러야 반영)`)) return
    const ids = new Set(targets.map((t) => t.id))
    setDraft((d) => d.map((t) => (ids.has(t.id) ? { ...t, owner: moveTo } : t)))
    setSel(new Set())
  }

  const save = async () => {
    const bad = draft.find((t) => !t.title.trim())
    if (bad) return alert('업무명이 비어 있는 행이 있습니다.')
    const norm = [...draft].sort((a, b) => a.order - b.order).map((t, i) => ({ ...t, title: t.title.trim(), order: i + 1 }))
    setDraft(norm)
    setBusy(true)
    try { await saveConfig((c) => ({ ...c, tasks: norm }), '업무 목록 수정') }
    catch { /* toast already shown */ } finally { setBusy(false) }
  }

  const exportXlsx = () => {
    const rows = draft.map((t, i) => ({
      순서: i + 1, 담당자: memberName(t.owner), 업무명: t.title, 주기: CYCLES.find((c) => c.v === t.cycle)!.l,
      요일: t.cycle === 'weekly' ? WD[t.weekday ?? 1] : '', 시작일: t.cycle === 'monthly' ? dayToKo(t.from) : '', 종료일: t.cycle === 'monthly' ? dayToKo(t.to) : '',
      사용: t.active ? 'O' : 'X', 비고: t.note ?? '', ID: t.id,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 5 }, { wch: 9 }, { wch: 44 }, { wch: 8 }, { wch: 5 }, { wch: 6 }, { wch: 6 }, { wch: 5 }, { wch: 24 }, { wch: 12 }]
    const guide = XLSX.utils.aoa_to_sheet([
      ['작성 방법'], ['주기: 상시 / 매일 / 매주 / 매월 / 신규현장'], ['요일: 매주일 때 월~일 중 하나'],
      ['시작일·종료일: 매월일 때 숫자(1~31) 또는 말일. 종료일이 시작일보다 작으면 익월로 처리 (예: 25 ~ 7 → 25일~익월 7일)'],
      ['하루짜리 업무는 시작일=종료일. 마감일이 휴일이면 다음 영업일로 자동 연장'],
      ['담당자: 설정 화면에 등록된 이름과 똑같이'], ['사용: O / X'], ['ID: 기존 업무 수정 시 그대로 두세요. 새 업무는 비워두면 됩니다.'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '업무목록')
    XLSX.utils.book_append_sheet(wb, guide, '작성방법')
    XLSX.writeFile(wb, '자재부_업무목록.xlsx')
  }

  const importXlsx = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer())
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    const errs: string[] = []
    const out: Task[] = []
    rows.forEach((r, i) => {
      const line = i + 2
      const title = String(r['업무명'] ?? '').trim()
      if (!title) return
      const m = auth.members.find((x) => x.name === String(r['담당자'] ?? '').trim())
      if (!m) return errs.push(`${line}행: 담당자 '${r['담당자']}' 없음`)
      const cycle = cycleFromKo(String(r['주기'] ?? ''))
      if (!cycle) return errs.push(`${line}행: 주기 '${r['주기']}' 인식 불가`)
      const t: Task = { id: String(r['ID'] ?? '').trim() || uid(), title, owner: m.id, cycle, active: String(r['사용'] ?? 'O').trim().toUpperCase() !== 'X', order: out.length + 1 }
      if (cycle === 'weekly') {
        const w = WD.indexOf(String(r['요일'] ?? '').trim().replace('요일', ''))
        if (w < 0) return errs.push(`${line}행: 요일 '${r['요일']}' 인식 불가`)
        t.weekday = w
      }
      if (cycle === 'monthly') {
        const a = dayFromKo(r['시작일']), b = dayFromKo(r['종료일'])
        if (a === undefined) return errs.push(`${line}행: 시작일 '${r['시작일']}' 인식 불가`)
        t.from = a; t.to = b ?? a
      }
      const note = String(r['비고'] ?? '').trim()
      if (note) t.note = note
      out.push(t)
    })
    if (errs.length) return alert(`엑셀에 오류가 있어 불러오지 않았습니다.\n\n${errs.slice(0, 15).join('\n')}${errs.length > 15 ? `\n…외 ${errs.length - 15}건` : ''}`)
    if (!out.length) return alert('불러올 업무가 없습니다.')
    const replace = confirm(`${out.length}건을 읽었습니다.\n\n[확인] 현재 목록을 엑셀 내용으로 교체\n[취소] 현재 목록 뒤에 추가`)
    if (replace) setDraft(out)
    else {
      const ids = new Set(draft.map((t) => t.id))
      const base = draft.length
      setDraft([...draft, ...out.map((t, i) => ({ ...t, id: ids.has(t.id) ? uid() : t.id, order: base + i + 1 }))])
    }
  }

  const ownerCount = (id: string) => draft.filter((t) => t.owner === id).length

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <select className="inp" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="all">전체 담당자 ({draft.length})</option>
          {auth.members.map((m) => <option key={m.id} value={m.id}>{m.name} ({ownerCount(m.id)})</option>)}
        </select>
        <input className="inp w-44" placeholder="업무명 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={addRow}>+ 업무 추가</button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button className="btn" onClick={exportXlsx}>엑셀 내려받기</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>엑셀 올리기</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = '' }} />
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-[11px] font-semibold text-red-600">저장 안 된 변경사항</span>}
          {dirty && <button className="btn" onClick={() => setDraft(structuredClone(config.tasks).sort((a, b) => a.order - b.order))}>되돌리기</button>}
          <button className="btn-amber py-1.5" disabled={!dirty || busy} onClick={save}>{busy ? '저장 중…' : 'GitHub에 저장'}</button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 bg-amber-soft/50 p-3 text-[12px]">
        <b className="text-navy">담당업무 이관</b>
        <span className="text-slate-500">{sel.size ? `선택한 ${sel.size}건을` : '담당자 업무 전체를'}</span>
        {!sel.size && (
          <select className="inp" value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)}>
            <option value="">보내는 사람</option>
            {auth.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <span>→</span>
        <select className="inp" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
          <option value="">받는 사람</option>
          {auth.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button className="btn" onClick={transfer}>이관</button>
        {sel.size > 0 && <button className="btn" onClick={() => setSel(new Set())}>선택 해제</button>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12px]">
          <thead className="bg-slate-50 text-[11px] text-slate-500">
            <tr>
              <th className="w-8 p-2"><input type="checkbox" checked={view.length > 0 && view.every((t) => sel.has(t.id))} onChange={(e) => setSel(e.target.checked ? new Set(view.map((t) => t.id)) : new Set())} /></th>
              <th className="w-14 p-2">순서</th><th className="w-28 p-2 text-left">담당자</th><th className="p-2 text-left">업무명</th>
              <th className="w-24 p-2 text-left">주기</th><th className="w-40 p-2 text-left">일정</th><th className="w-40 p-2 text-left">비고</th>
              <th className="w-12 p-2">사용</th><th className="w-12 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {view.map((t) => (
              <tr key={t.id} className={`border-t border-slate-100 ${t.active ? '' : 'bg-slate-50 text-slate-400'} ${sel.has(t.id) ? 'bg-amber-soft/40' : ''}`}>
                <td className="p-1 text-center"><input type="checkbox" checked={sel.has(t.id)} onChange={(e) => { const s = new Set(sel); e.target.checked ? s.add(t.id) : s.delete(t.id); setSel(s) }} /></td>
                <td className="p-1 text-center">
                  <button className="px-1 text-slate-400 hover:text-navy" onClick={() => move(t, -1)}>▲</button>
                  <button className="px-1 text-slate-400 hover:text-navy" onClick={() => move(t, 1)}>▼</button>
                </td>
                <td className="p-1"><select className="inp w-full" value={t.owner} onChange={(e) => upd(t.id, { owner: e.target.value })}>
                  {auth.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  {!auth.members.some((m) => m.id === t.owner) && <option value={t.owner}>(삭제된 담당자)</option>}
                </select></td>
                <td className="p-1"><input className="inp w-full" value={t.title} onChange={(e) => upd(t.id, { title: e.target.value })} /></td>
                <td className="p-1"><select className="inp w-full" value={t.cycle} onChange={(e) => upd(t.id, { cycle: e.target.value as CycleType })}>
                  {CYCLES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select></td>
                <td className="p-1">
                  {t.cycle === 'weekly' && (
                    <select className="inp" value={t.weekday ?? 1} onChange={(e) => upd(t.id, { weekday: +e.target.value })}>
                      {WD.map((w, i) => <option key={i} value={i}>{w}요일</option>)}
                    </select>
                  )}
                  {t.cycle === 'monthly' && (
                    <div className="flex items-center gap-1">
                      <DaySel v={t.from ?? 1} on={(v) => upd(t.id, { from: v })} />~<DaySel v={t.to ?? t.from ?? 1} on={(v) => upd(t.id, { to: v })} />
                    </div>
                  )}
                  {(t.cycle === 'weekly' || t.cycle === 'monthly') && <div className="mt-0.5 text-[10px] text-slate-400">{cycleLabel(t)}</div>}
                </td>
                <td className="p-1"><input className="inp w-full" value={t.note ?? ''} onChange={(e) => upd(t.id, { note: e.target.value || undefined })} /></td>
                <td className="p-1 text-center"><input type="checkbox" checked={t.active} onChange={(e) => upd(t.id, { active: e.target.checked })} /></td>
                <td className="p-1 text-center"><button className="text-red-500 hover:text-red-700" onClick={() => delRow(t)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">종료일이 시작일보다 작으면 익월로 계산됩니다 (예: 25 ~ 7 → 25일~익월 7일). 마감일이 주말·휴무일이면 다음 영업일로 자동 연장됩니다.</p>
    </div>
  )
}

function DaySel({ v, on }: { v: number; on: (v: number) => void }) {
  return (
    <select className="inp px-1" value={v} onChange={(e) => on(+e.target.value)}>
      {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}일</option>)}
      <option value={-1}>말일</option>
    </select>
  )
}
