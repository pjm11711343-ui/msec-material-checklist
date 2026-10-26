import { useState } from 'react'
import { GH } from '../lib/github'
import { b64, decryptToken, encryptToken, newDataKey, unb64, unwrapDataKey, wrapDataKey } from '../lib/crypto'
import { seedConfig, seedMembers } from '../lib/seed'
import { rememberRepo } from '../lib/authload'
import type { AuthFile, Config, Member, Session } from '../lib/types'

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-navy p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-1 text-[11px] font-bold tracking-widest text-amber">명신기공 자재부</div>
        <h1 className="text-xl font-bold text-navy">{title}</h1>
        <p className="mb-5 mt-1 text-[12px] text-slate-500">{sub}</p>
        {children}
      </div>
    </div>
  )
}

export function Login({ auth, onLogin, onSetup }: { auth: AuthFile; onLogin: (s: Session) => void; onSetup: () => void }) {
  const ready = auth.members.filter((m) => m.wrapped)
  const [mid, setMid] = useState(ready[0]?.id ?? '')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const m = auth.members.find((x) => x.id === mid)
    if (!m) return setErr('담당자를 선택하세요.')
    if (!pw) return setErr('비밀번호를 입력하세요.')
    setBusy(true); setErr('')
    try {
      const dk = await unwrapDataKey(m, pw)
      const token = await decryptToken(dk, auth.tokenIv, auth.tokenCt)
      onLogin({ memberId: m.id, token, dataKey: b64(dk) })
    } catch {
      setErr('비밀번호가 맞지 않습니다.')
    } finally { setBusy(false) }
  }

  return (
    <Shell title="업무 체크리스트 로그인" sub="이름을 선택하고 비밀번호를 입력하세요.">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <div className="lbl mb-1">담당자</div>
          <div className="grid grid-cols-3 gap-2">
            {ready.map((m) => (
              <button type="button" key={m.id} onClick={() => setMid(m.id)}
                className={`rounded-xl border px-2 py-2.5 text-[13px] font-semibold transition ${mid === m.id ? 'border-amber bg-amber-soft text-navy' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {m.name}
              </button>
            ))}
          </div>
          {ready.length === 0 && <p className="text-[12px] text-red-600">비밀번호가 설정된 담당자가 없습니다.</p>}
        </div>
        <div>
          <div className="lbl mb-1">비밀번호</div>
          <input type="password" className="inp w-full py-2 text-[14px]" value={pw} onChange={(e) => { setPw(e.target.value); setErr('') }} autoFocus />
        </div>
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <button className="btn-amber w-full justify-center py-2.5 text-[14px]" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
        <p className="text-center text-[11px] text-slate-400">비밀번호를 잊으면 관리자에게 재설정을 요청하세요.</p>
      </form>
      <button onClick={onSetup} className="mt-4 w-full text-center text-[11px] text-slate-300 hover:text-slate-500">초기 설정 다시 하기</button>
    </Shell>
  )
}

export function Setup({ existing, onDone, onCancel }: { existing: AuthFile | null; onDone: (a: AuthFile, s: Session, c: Config) => void; onCancel?: () => void }) {
  const [f, setF] = useState({
    owner: existing?.owner ?? '', appRepo: existing?.appRepo ?? 'msec-material-checklist', dataRepo: existing?.dataRepo ?? 'msec-material-checklist-data',
    branch: existing?.branch ?? 'main', token: '', name: '총괄', pw: '', pw2: '',
  })
  const [log, setLog] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.trim() })

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!f.owner || !f.appRepo || !f.dataRepo || !f.token) return setErr('GitHub 계정, 저장소 이름, 토큰을 모두 입력하세요.')
    if (f.pw.length < 6) return setErr('관리자 비밀번호는 6자 이상으로 해주세요.')
    if (f.pw !== f.pw2) return setErr('비밀번호 확인이 일치하지 않습니다.')
    setBusy(true); setLog([])
    const add = (s: string) => setLog((l) => [...l, s])
    try {
      const gh = new GH(f.token)
      const app = { owner: f.owner, repo: f.appRepo, branch: f.branch }
      const data = { owner: f.owner, repo: f.dataRepo, branch: f.branch }
      add('저장소 권한 확인 중…')
      const check = async (r: typeof app, label: string) => {
        try { return await gh.repoInfo(r) } catch (e: any) {
          if (String(e.message).includes('404'))
            throw new Error(`${label} '${r.owner}/${r.repo}'에 접근할 수 없습니다. ① 계정·저장소 이름 철자 ② 토큰 발급 시 Repository access에서 이 저장소를 선택했는지 확인하세요.`)
          throw e
        }
      }
      const ai = await check(app, '프로그램 저장소')
      add('프로그램 저장소 확인 완료')
      const di = await check(data, '데이터 저장소')
      add('데이터 저장소 확인 완료')
      if (!ai.push || !di.push) throw new Error('토큰에 저장소 쓰기(Contents: Read and write) 권한이 없습니다.')
      if (!di.private && f.appRepo !== f.dataRepo) add('주의: 데이터 저장소가 공개(public)입니다. 비공개(private)를 권장합니다.')
      const authPath = 'public/auth.json'
      const cur = await gh.get<AuthFile>(app, authPath)
      if (cur && cur.data.members?.some((m) => m.wrapped)) {
        if (!confirm('이미 설정된 auth.json이 있습니다. 덮어쓰면 모든 담당자의 비밀번호가 초기화됩니다. 계속할까요?')) throw new Error('취소했습니다.')
      }
      add('업무 목록(config.json) 확인 중…')
      const cfgPath = 'data/config.json'
      let cfg = (await gh.get<Config>(data, cfgPath))?.data
      if (!cfg) {
        cfg = seedConfig()
        await gh.put(data, cfgPath, cfg, undefined, '초기 업무 목록 생성')
        add('초기 업무 목록 생성 완료')
      } else add('기존 업무 목록 사용')
      add('토큰 암호화 중…')
      const dk = newDataKey()
      // 기존 설정이 있으면 담당자 명단은 유지(비밀번호는 초기화), 없으면 기본 명단
      const members: Member[] = cur?.data.members?.length
        ? cur.data.members.map((m) => ({ id: m.id, name: m.name, role: m.role }))
        : seedMembers(f.name)
      let admin = members.find((m) => m.id === 'lead')
      if (!admin) { admin = { id: 'lead', name: f.name, role: 'admin' }; members.unshift(admin) }
      admin.name = f.name || admin.name
      admin.role = 'admin'
      Object.assign(admin, await wrapDataKey(dk, f.pw))
      const auth: AuthFile = {
        version: 1, owner: f.owner, appRepo: f.appRepo, dataRepo: f.dataRepo, branch: f.branch, authPath, dataDir: 'data',
        ...(await encryptToken(dk, f.token)), members,
      }
      add('auth.json 커밋 중…')
      await gh.put(app, authPath, auth, cur?.sha, '체크리스트 초기 설정')
      rememberRepo(auth)
      add('완료! 사이트 반영까지 1~2분 걸립니다.')
      onDone(auth, { memberId: 'lead', token: f.token, dataKey: b64(dk) }, cfg)
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally { setBusy(false) }
  }

  return (
    <Shell title="초기 설정 (관리자)" sub="처음 한 번만 합니다. 토큰은 비밀번호로 암호화되어 저장됩니다.">
      <form onSubmit={run} className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2"><div className="lbl">GitHub 계정/조직 이름</div><input className="inp w-full" value={f.owner} onChange={set('owner')} placeholder="myungshin" /></label>
          <label><div className="lbl">프로그램 저장소</div><input className="inp w-full" value={f.appRepo} onChange={set('appRepo')} /></label>
          <label><div className="lbl">데이터 저장소 (비공개 권장)</div><input className="inp w-full" value={f.dataRepo} onChange={set('dataRepo')} /></label>
          <label><div className="lbl">브랜치</div><input className="inp w-full" value={f.branch} onChange={set('branch')} /></label>
          <label><div className="lbl">관리자 이름</div><input className="inp w-full" value={f.name} onChange={set('name')} /></label>
          <label className="col-span-2"><div className="lbl">GitHub 토큰 (fine-grained, Contents 읽기/쓰기)</div><input type="password" className="inp w-full" value={f.token} onChange={set('token')} placeholder="github_pat_..." /></label>
          <label><div className="lbl">관리자 비밀번호</div><input type="password" className="inp w-full" value={f.pw} onChange={set('pw')} /></label>
          <label><div className="lbl">비밀번호 확인</div><input type="password" className="inp w-full" value={f.pw2} onChange={set('pw2')} /></label>
        </div>
        {log.length > 0 && <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{log.map((l, i) => <div key={i}>· {l}</div>)}</div>}
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex gap-2 pt-1">
          {onCancel && <button type="button" className="btn flex-1 justify-center py-2" onClick={onCancel}>취소</button>}
          <button className="btn-amber flex-1 justify-center py-2 text-[13px]" disabled={busy}>{busy ? '설정 중…' : '설정 완료'}</button>
        </div>
      </form>
    </Shell>
  )
}

export const dataKeyBytes = (s: Session) => unb64(s.dataKey)
