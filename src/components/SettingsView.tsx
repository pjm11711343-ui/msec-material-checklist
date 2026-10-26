import { useState } from 'react'
import { useStore } from '../lib/store'
import { encryptToken, unb64, unwrapDataKey, wrapDataKey } from '../lib/crypto'
import { GH } from '../lib/github'
import { uid } from '../lib/schedule'
import type { Member } from '../lib/types'

export default function SettingsView() {
  const { me } = useStore()
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <MyPassword />
      {me.role === 'admin' && <Members />}
      {me.role === 'admin' && <Holidays />}
      {me.role === 'admin' && <TokenBox />}
    </div>
  )
}

function Box({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-[14px] font-bold text-navy">{title}</div>
      {sub && <div className="mb-3 mt-0.5 text-[11px] text-slate-400">{sub}</div>}
      {children}
    </div>
  )
}

function MyPassword() {
  const { me, session, saveAuth } = useStore()
  const [cur, setCur] = useState(''), [pw, setPw] = useState(''), [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const go = async () => {
    setErr('')
    if (pw.length < 6) return setErr('새 비밀번호는 6자 이상')
    if (pw !== pw2) return setErr('새 비밀번호 확인이 다릅니다')
    try { await unwrapDataKey(me, cur) } catch { return setErr('현재 비밀번호가 맞지 않습니다') }
    const w = await wrapDataKey(unb64(session.dataKey), pw)
    await saveAuth((a) => ({ ...a, members: a.members.map((m) => (m.id === me.id ? { ...m, ...w } : m)) }), '비밀번호 변경')
    setCur(''); setPw(''); setPw2('')
  }
  return (
    <Box title="내 비밀번호 변경" sub={`${me.name} 계정`}>
      <div className="flex flex-wrap items-end gap-2">
        <label><div className="lbl">현재 비밀번호</div><input type="password" className="inp" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
        <label><div className="lbl">새 비밀번호</div><input type="password" className="inp" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label><div className="lbl">새 비밀번호 확인</div><input type="password" className="inp" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn-amber py-1.5" onClick={go}>변경</button>
        {err && <span className="text-[12px] text-red-600">{err}</span>}
      </div>
    </Box>
  )
}

function Members() {
  const { auth, session, saveAuth, config, me } = useStore()
  const [newName, setNewName] = useState('')
  const [pwFor, setPwFor] = useState<string | null>(null)
  const [pw, setPw] = useState('')

  const patch = (id: string, p: Partial<Member>, msg: string) => saveAuth((a) => ({ ...a, members: a.members.map((m) => (m.id === id ? { ...m, ...p } : m)) }), msg)

  const add = async () => {
    const n = newName.trim()
    if (!n) return
    if (auth.members.some((m) => m.name === n)) return alert('같은 이름이 있습니다.')
    await saveAuth((a) => ({ ...a, members: [...a.members, { id: uid(), name: n, role: 'user' }] }), `담당자 추가: ${n}`)
    setNewName('')
  }
  const rename = (m: Member) => {
    const n = prompt('새 이름', m.name)?.trim()
    if (n && n !== m.name) patch(m.id, { name: n }, `담당자 이름 변경: ${m.name} → ${n}`)
  }
  const setPassword = async (m: Member) => {
    if (pw.length < 6) return alert('비밀번호는 6자 이상으로 해주세요.')
    const w = await wrapDataKey(unb64(session.dataKey), pw)
    await patch(m.id, w, `비밀번호 설정: ${m.name}`)
    setPwFor(null); setPw('')
  }
  const remove = (m: Member) => {
    const n = config.tasks.filter((t) => t.owner === m.id).length
    if (n) return alert(`${m.name}에게 업무가 ${n}건 있습니다. '업무 관리'에서 먼저 이관하세요.`)
    if (!confirm(`${m.name} 담당자를 삭제할까요?`)) return
    saveAuth((a) => ({ ...a, members: a.members.filter((x) => x.id !== m.id) }), `담당자 삭제: ${m.name}`)
  }
  const block = (m: Member) => {
    if (!confirm(`${m.name}의 로그인을 막을까요? (비밀번호 삭제, 다시 설정하면 복구)`)) return
    patch(m.id, { salt: undefined, iv: undefined, wrapped: undefined }, `로그인 차단: ${m.name}`)
  }

  return (
    <Box title="담당자 관리" sub="비밀번호를 설정해야 로그인할 수 있습니다. 변경 내용은 다른 PC에 1~2분 뒤 반영됩니다.">
      <table className="w-full text-[12px]">
        <thead className="text-[11px] text-slate-500"><tr className="border-b border-slate-200"><th className="py-1 text-left">이름</th><th className="text-left">권한</th><th className="text-left">로그인</th><th className="text-left">업무 수</th><th /></tr></thead>
        <tbody>
          {auth.members.map((m) => (
            <tr key={m.id} className="border-b border-slate-100">
              <td className="py-1.5 font-semibold">{m.name}</td>
              <td>
                <select className="inp py-0.5" value={m.role} disabled={m.id === me.id}
                  onChange={(e) => patch(m.id, { role: e.target.value as Member['role'] }, `권한 변경: ${m.name}`)}>
                  <option value="user">담당자</option><option value="admin">관리자</option>
                </select>
              </td>
              <td>{m.wrapped ? <span className="text-emerald-600">가능</span> : <span className="text-red-500">비밀번호 미설정</span>}</td>
              <td>{config.tasks.filter((t) => t.owner === m.id).length}건</td>
              <td className="py-1 text-right">
                {pwFor === m.id ? (
                  <span className="inline-flex gap-1">
                    <input type="password" className="inp w-32" placeholder="새 비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
                    <button className="btn-amber" onClick={() => setPassword(m)}>저장</button>
                    <button className="btn" onClick={() => { setPwFor(null); setPw('') }}>취소</button>
                  </span>
                ) : (
                  <span className="inline-flex gap-1">
                    <button className="btn" onClick={() => rename(m)}>이름</button>
                    <button className="btn" onClick={() => { setPwFor(m.id); setPw('') }}>{m.wrapped ? '비밀번호 재설정' : '비밀번호 설정'}</button>
                    {m.id !== me.id && m.wrapped && <button className="btn" onClick={() => block(m)}>로그인 차단</button>}
                    {m.id !== me.id && <button className="btn text-red-600" onClick={() => remove(m)}>삭제</button>}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex gap-2">
        <input className="inp w-48" placeholder="새 담당자 이름" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn" onClick={add}>+ 담당자 추가</button>
      </div>
    </Box>
  )
}

function Holidays() {
  const { config, saveConfig } = useStore()
  const [txt, setTxt] = useState(config.holidays.join('\n'))
  const [start, setStart] = useState(config.startDate ?? '')
  const save = () => {
    const list = [...new Set(txt.split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)))].sort()
    saveConfig((c) => ({ ...c, holidays: list, startDate: start || undefined }), '휴무일·사용 시작일 수정').then(() => setTxt(list.join('\n'))).catch(() => {})
  }
  return (
    <Box title="사용 시작일 · 휴무일" sub="주말은 자동 제외. 한 줄에 하나씩 2026-12-25 형식으로 입력하세요. 휴무일에는 상시 업무가 빠지고, 월간 업무 마감이 다음 영업일로 밀립니다.">
 <label className="mb-2 flex items-center gap-2 text-[12px]"><span className="lbl">사용 시작일</span>
        <input type="date" className="inp" value={start} onChange={(e) => setStart(e.target.value)} />
        <span className="text-[11px] text-slate-400">이 날짜 이전은 지연·누락으로 표시하지 않습니다</span></label>
      <textarea className="inp h-32 w-full font-mono" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'2026-12-25\n2027-01-01'} />
      <button className="btn-amber mt-2 py-1.5" onClick={save}>저장</button>
    </Box>
  )
}

function TokenBox() {
  const { auth, session, saveAuth } = useStore()
  const [tk, setTk] = useState('')
  const [err, setErr] = useState('')
  const go = async () => {
    setErr('')
    if (!tk.trim()) return
    try {
      const gh = new GH(tk.trim())
      const a = await gh.repoInfo({ owner: auth.owner, repo: auth.appRepo, branch: auth.branch })
      const d = await gh.repoInfo({ owner: auth.owner, repo: auth.dataRepo, branch: auth.branch })
      if (!a.push || !d.push) return setErr('새 토큰에 쓰기 권한이 없습니다.')
    } catch (e: any) { return setErr(e.message ?? String(e)) }
    const enc = await encryptToken(unb64(session.dataKey), tk.trim())
    await saveAuth((a) => ({ ...a, ...enc }), 'GitHub 토큰 교체')
    setTk('')
    alert('토큰을 교체했습니다. 다시 로그인하면 새 토큰이 적용됩니다. 기존 토큰은 GitHub에서 삭제(Revoke)하세요.')
  }
  return (
    <Box title="GitHub 연동" sub="토큰이 만료되기 전에 새 토큰으로 교체하세요. 담당자 비밀번호는 그대로 유지됩니다.">
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] md:grid-cols-4">
        <div><span className="lbl">계정</span><div>{auth.owner}</div></div>
        <div><span className="lbl">프로그램 저장소</span><div>{auth.appRepo}</div></div>
        <div><span className="lbl">데이터 저장소</span><div>{auth.dataRepo}</div></div>
        <div><span className="lbl">브랜치</span><div>{auth.branch}</div></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="password" className="inp w-80" placeholder="새 토큰 github_pat_..." value={tk} onChange={(e) => setTk(e.target.value)} />
        <button className="btn-amber py-1.5" onClick={go}>토큰 교체</button>
        <a className="btn" href={`https://github.com/${auth.owner}/${auth.dataRepo}/commits`} target="_blank" rel="noreferrer">체크 기록(커밋) 보기</a>
        {err && <span className="text-[12px] text-red-600">{err}</span>}
      </div>
    </Box>
  )
}
