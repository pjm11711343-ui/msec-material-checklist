import type { AuthFile } from './types'

const LS_REPO = 'msec-chk-repo'

export function rememberRepo(a: Pick<AuthFile, 'owner' | 'appRepo' | 'branch' | 'authPath'>) {
  try { localStorage.setItem(LS_REPO, JSON.stringify(a)) } catch { /* noop */ }
}

async function tryJson(url: string): Promise<AuthFile | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const j = JSON.parse(await res.text())
    return j && j.version === 1 && Array.isArray(j.members) ? (j as AuthFile) : null
  } catch { return null }
}

/** 배포된 사이트의 auth.json → (로컬 개발 시) 저장소 raw 파일 순서로 찾음 */
export async function loadAuth(): Promise<AuthFile | null> {
  const local = await tryJson(`${import.meta.env.BASE_URL}auth.json?t=${Date.now()}`)
  if (local) return local
  try {
    const r = JSON.parse(localStorage.getItem(LS_REPO) ?? 'null')
    if (r?.owner) return await tryJson(`https://raw.githubusercontent.com/${r.owner}/${r.appRepo}/${r.branch}/${r.authPath}?t=${Date.now()}`)
  } catch { /* noop */ }
  return null
}
