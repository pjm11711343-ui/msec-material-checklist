import { useStore } from '../lib/store'
import type { Site, Task } from '../lib/types'

const OWNER_COLORS = ['bg-amber-soft text-amber-900', 'bg-sky-100 text-sky-900', 'bg-emerald-100 text-emerald-900', 'bg-violet-100 text-violet-900', 'bg-rose-100 text-rose-900', 'bg-slate-200 text-slate-800']

export function OwnerBadge({ id }: { id: string }) {
  const { auth, memberName } = useStore()
  const i = Math.max(0, auth.members.findIndex((m) => m.id === id))
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${OWNER_COLORS[i % OWNER_COLORS.length]}`}>{memberName(id)}</span>
}

export function Check({ on, disabled, onClick, title }: { on: boolean; disabled?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition ${on ? 'border-amber bg-amber text-navy' : 'border-slate-300 bg-white hover:border-amber'} disabled:cursor-not-allowed disabled:opacity-50`}>
      {on && <svg key="v" className="pop" width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  )
}

export function OwnerFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { auth } = useStore()
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {[{ id: 'all', name: '전체' }, ...auth.members].map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)}
          className={`rounded-lg px-2.5 py-1 text-[12px] transition ${value === m.id ? 'bg-white font-semibold text-navy shadow-sm' : 'text-slate-500 hover:text-navy'}`}>
          {m.name}
        </button>
      ))}
    </div>
  )
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div className="h-full rounded-full bg-amber transition-all duration-500" style={{ width: `${value}%` }} />
    </div>
  )
}

/** 신규현장 업무가 이 현장에 해당하는지 (담당 현장 지정 시 해당 담당자 + 관리자 업무만) */
export function useEventApplies() {
  const { auth } = useStore()
  return (t: Task, s: Site) => !s.manager || t.owner === s.manager || auth.members.find((m) => m.id === t.owner)?.role === 'admin'
}

export function fmtAt(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
