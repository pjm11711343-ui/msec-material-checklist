import { useEffect, useState } from 'react'
import { loadAuth, rememberRepo } from './lib/authload'
import { GH } from './lib/github'
import { StoreProvider, configPath, dataRepoOf, useStore } from './lib/store'
import type { AuthFile, Config, Session } from './lib/types'
import { Login, Setup } from './components/Gate'
import TodayView from './components/TodayView'
import MatrixView from './components/MatrixView'
import SitesView from './components/SitesView'
import TasksAdmin from './components/TasksAdmin'
import SettingsView from './components/SettingsView'
import { seedConfig } from './lib/seed'

const SS = 'msec-chk-session'

export default function App() {
  const [auth, setAuth] = useState<AuthFile | null | undefined>(undefined)
  const [session, setSession] = useState<Session | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [setupMode, setSetupMode] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    loadAuth().then((a) => {
      setAuth(a)
      if (a) rememberRepo(a)
      try {
        const s = JSON.parse(sessionStorage.getItem(SS) ?? 'null') as Session | null
        if (a && s && a.members.some((m) => m.id === s.memberId)) setSession(s)
      } catch { /* noop */ }
    })
  }, [])

  useEffect(() => {
    if (!auth || !session || config) return
    new GH(session.token).get<Config>(dataRepoOf(auth), configPath(auth))
      .then((c) => setConfig(c?.data ?? seedConfig()))
      .catch((e) => { setErr(e.message ?? String(e)); sessionStorage.removeItem(SS); setSession(null) })
  }, [auth, session, config])

  const login = (s: Session) => { sessionStorage.setItem(SS, JSON.stringify(s)); setErr(''); setSession(s) }
  const logout = () => { sessionStorage.removeItem(SS); setSession(null); setConfig(null) }

  if (auth === undefined) return <Center>불러오는 중…</Center>
  if (!auth || setupMode)
    return <Setup existing={auth} onCancel={auth ? () => setSetupMode(false) : undefined}
      onDone={(a, s, c) => { setAuth(a); setConfig(c); setSetupMode(false); login(s) }} />
  if (!session) return (
    <>
      <Login auth={auth} onLogin={login} onSetup={() => setSetupMode(true)} />
      {err && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-red-600 px-4 py-2 text-white">{err}</div>}
    </>
  )
  if (!config) return <Center>업무 목록 불러오는 중…</Center>

  return (
    <StoreProvider auth={auth} setAuth={setAuth} session={session} initialConfig={config} onLogout={logout}>
      <Main />
    </StoreProvider>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center bg-navy text-slate-300">{children}</div>
}

type View = 'today' | 'matrix' | 'sites' | 'tasks' | 'settings'

function Main() {
  const { me, saving, reloadAll, logout, auth, toast } = useStore()
  const [view, setView] = useState<View>('today')
  const nav: { id: View; label: string; admin?: boolean }[] = [
    { id: 'today', label: '오늘 할 일' },
    { id: 'matrix', label: '월간 점검표' },
    { id: 'sites', label: '신규현장' },
    { id: 'tasks', label: '업무 관리', admin: true },
    { id: 'settings', label: '설정' },
  ]

  useEffect(() => {
    let last = Date.now()
    const onFocus = () => { if (Date.now() - last > 60000) { last = Date.now(); reloadAll().catch(() => {}) } }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reloadAll])

  return (
    <div className="flex h-full">
      <aside className="no-print flex w-48 shrink-0 flex-col bg-navy text-slate-300">
        <div className="px-4 pb-4 pt-5">
          <div className="text-[10px] font-bold tracking-widest text-amber">명신기공 자재부</div>
          <div className="mt-0.5 text-[15px] font-bold text-white">업무 체크리스트</div>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {nav.filter((n) => !n.admin || me.role === 'admin').map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={`rounded-lg px-3 py-2 text-left text-[13px] transition ${view === n.id ? 'bg-navy-3 font-semibold text-amber' : 'hover:bg-navy-2 hover:text-white'}`}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-2 border-t border-navy-3 p-3 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-white">{me.name} <span className="text-slate-500">{me.role === 'admin' ? '관리자' : '담당자'}</span></span>
            <span className={`h-2 w-2 rounded-full ${saving ? 'animate-pulse bg-amber' : 'bg-emerald-500'}`} title={saving ? 'GitHub 저장 중' : '저장 완료'} />
          </div>
          <div className="truncate text-slate-500" title={`${auth.owner}/${auth.dataRepo}`}>{auth.owner}/{auth.dataRepo}</div>
          <div className="flex gap-1.5">
            <button className="flex-1 rounded-md bg-navy-2 py-1 hover:bg-navy-3" onClick={() => reloadAll().then(() => toast('새로고침 완료'))}>새로고침</button>
            <button className="flex-1 rounded-md bg-navy-2 py-1 hover:bg-navy-3" onClick={logout}>로그아웃</button>
          </div>
        </div>
      </aside>
      <main className="print-full min-w-0 flex-1 overflow-auto p-4">
        {view === 'today' && <TodayView />}
        {view === 'matrix' && <MatrixView />}
        {view === 'sites' && <SitesView />}
        {view === 'tasks' && me.role === 'admin' && <TasksAdmin />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
