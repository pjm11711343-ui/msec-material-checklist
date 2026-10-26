import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { GH, type Repo } from './github'
import type { AuthFile, Config, Member, Rec, RecFile, Session } from './types'
import { parseYmd, type Recs } from './schedule'

interface Toast { id: number; text: string; kind: 'ok' | 'err' }

interface Store {
  auth: AuthFile
  setAuth: (a: AuthFile) => void
  session: Session
  me: Member
  gh: GH
  config: Config
  recs: Recs
  holidays: Set<string>
  startD?: Date
  saving: number
  ensureFiles: (names: string[], force?: boolean) => Promise<void>
  setRec: (file: string, key: string, on: boolean, label: string) => Promise<void>
  saveConfig: (mutate: (c: Config) => Config, msg: string) => Promise<void>
  saveAuth: (mutate: (a: AuthFile) => AuthFile, msg: string) => Promise<void>
  reloadAll: () => Promise<void>
  toast: (text: string, kind?: 'ok' | 'err') => void
  memberName: (id: string) => string
  logout: () => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => { const s = useContext(Ctx); if (!s) throw new Error('no store'); return s }

export const dataRepoOf = (a: AuthFile): Repo => ({ owner: a.owner, repo: a.dataRepo, branch: a.branch })
export const appRepoOf = (a: AuthFile): Repo => ({ owner: a.owner, repo: a.appRepo, branch: a.branch })
export const configPath = (a: AuthFile) => `${a.dataDir}/config.json`
export const recPath = (a: AuthFile, file: string) => `${a.dataDir}/records/${file}.json`

export function StoreProvider(props: {
  auth: AuthFile; setAuth: (a: AuthFile) => void; session: Session; initialConfig: Config; onLogout: () => void; children: ReactNode
}) {
  const { auth, setAuth, session } = props
  const gh = useMemo(() => new GH(session.token), [session.token])
  const [config, setConfig] = useState<Config>(props.initialConfig)
  const [recs, setRecs] = useState<Recs>({})
  const [saving, setSaving] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const loading = useRef<Record<string, Promise<void> | undefined>>({})
  const recsRef = useRef<Recs>({})
  recsRef.current = recs

  const me = auth.members.find((m) => m.id === session.memberId) ?? { id: session.memberId, name: '?', role: 'user' as const }
  const holidays = useMemo(() => new Set(config.holidays), [config.holidays])
  const startD = useMemo(() => (config.startDate ? parseYmd(config.startDate) : undefined), [config.startDate])

  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 2500)
  }, [])

  const ensureFiles = useCallback(async (names: string[], force = false) => {
    const repo = dataRepoOf(auth)
    await Promise.all(names.map((n) => {
      if (!force && (recsRef.current[n] || loading.current[n])) return loading.current[n]
      const p = gh.get<RecFile>(repo, recPath(auth, n))
        .then((r) => setRecs((s) => ({ ...s, [n]: r?.data ?? {} })))
        .catch((e) => toast(String(e.message ?? e), 'err'))
        .finally(() => { delete loading.current[n] })
      loading.current[n] = p
      return p
    }))
  }, [auth, gh, toast])

  const track = async <T,>(fn: () => Promise<T>) => {
    setSaving((n) => n + 1)
    try { return await fn() } finally { setSaving((n) => n - 1) }
  }

  const setRec = useCallback(async (file: string, key: string, on: boolean, label: string) => {
    const rec: Rec = { by: me.id, at: new Date().toISOString() }
    const prev = recsRef.current[file]?.[key]
    const apply = (f: RecFile | undefined, v: Rec | undefined) => {
      const n = { ...(f ?? {}) }
      if (v) n[key] = v; else delete n[key]
      return n
    }
    setRecs((s) => ({ ...s, [file]: apply(s[file], on ? rec : undefined) }))
    try {
      const next = await track(() => gh.update<RecFile>(dataRepoOf(auth), recPath(auth, file), () => ({}),
        (cur) => apply(cur, on ? rec : undefined), `${on ? '완료' : '취소'}: ${label} (${me.name})`))
      setRecs((s) => ({ ...s, [file]: next }))
    } catch (e: any) {
      setRecs((s) => ({ ...s, [file]: apply(s[file], prev) }))
      toast(`저장 실패 — ${e.message ?? e}`, 'err')
    }
  }, [auth, gh, me.id, me.name, toast])

  const saveConfig = useCallback(async (mutate: (c: Config) => Config, msg: string) => {
    try {
      const next = await track(() => gh.update<Config>(dataRepoOf(auth), configPath(auth), () => config,
        (cur) => ({ ...mutate(cur), updatedAt: new Date().toISOString() }), `${msg} (${me.name})`))
      setConfig(next)
      toast('저장되었습니다')
    } catch (e: any) { toast(`저장 실패 — ${e.message ?? e}`, 'err'); throw e }
  }, [auth, gh, config, me.name, toast])

  const saveAuth = useCallback(async (mutate: (a: AuthFile) => AuthFile, msg: string) => {
    try {
      const next = await track(() => gh.update<AuthFile>(appRepoOf(auth), auth.authPath, () => auth, mutate, `${msg} (${me.name})`))
      setAuth(next)
      toast('저장되었습니다. 다른 PC에는 1~2분 뒤 반영됩니다.')
    } catch (e: any) { toast(`저장 실패 — ${e.message ?? e}`, 'err'); throw e }
  }, [auth, gh, me.name, setAuth, toast])

  const reloadAll = useCallback(async () => {
    const c = await gh.get<Config>(dataRepoOf(auth), configPath(auth))
    if (c) setConfig(c.data)
    await ensureFiles(Object.keys(recsRef.current), true)
  }, [auth, gh, ensureFiles])

  const memberName = useCallback((id: string) => auth.members.find((m) => m.id === id)?.name ?? '(삭제된 담당자)', [auth.members])

  const value: Store = {
    auth, setAuth, session, me, gh, config, recs, holidays, startD, saving,
    ensureFiles, setRec, saveConfig, saveAuth, reloadAll, toast, memberName, logout: props.onLogout,
  }

  return (
    <Ctx.Provider value={value}>
      {props.children}
      <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`pop max-w-sm rounded-xl px-4 py-2.5 text-[12px] shadow-lg ${t.kind === 'err' ? 'bg-red-600 text-white' : 'bg-navy text-white'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
