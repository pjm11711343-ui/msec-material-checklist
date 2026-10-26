// GitHub Contents API로 JSON 파일 읽기/쓰기 (커밋)
const API = 'https://api.github.com'

export interface Repo { owner: string; repo: string; branch: string }

class Conflict extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const enc = new TextEncoder()
const dec = new TextDecoder()
function utf8ToB64(s: string) {
  const u = enc.encode(s)
  let bin = ''
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(bin)
}
function b64ToUtf8(s: string) {
  const bin = atob(s.replace(/\s/g, ''))
  return dec.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

async function toError(res: Response) {
  let msg = ''
  try { msg = (await res.json()).message } catch { /* noop */ }
  if (res.status === 401) return new Error('GitHub 토큰이 유효하지 않습니다 (401). 관리자에게 토큰 교체를 요청하세요.')
  if (res.status === 403) return new Error(`GitHub 권한/요청 제한 오류 (403): ${msg}`)
  if (res.status === 404) return new Error('저장소 또는 파일을 찾을 수 없습니다 (404). 저장소 이름과 토큰 권한을 확인하세요.')
  return new Error(`GitHub 오류 ${res.status}: ${msg}`)
}

export class GH {
  constructor(public token: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  async repoInfo(r: Repo): Promise<{ push: boolean; private: boolean }> {
    const res = await fetch(`${API}/repos/${r.owner}/${r.repo}`, { headers: this.headers(), cache: 'no-store' })
    if (!res.ok) throw await toError(res)
    const j = await res.json()
    return { push: !!j.permissions?.push, private: !!j.private }
  }

  async get<T>(r: Repo, path: string): Promise<{ data: T; sha: string } | null> {
    const url = `${API}/repos/${r.owner}/${r.repo}/contents/${encPath(path)}?ref=${encodeURIComponent(r.branch)}&_=${Date.now()}`
    const res = await fetch(url, { headers: this.headers(), cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) throw await toError(res)
    const j = await res.json()
    return { data: JSON.parse(b64ToUtf8(j.content)) as T, sha: j.sha }
  }

  async put(r: Repo, path: string, data: unknown, sha: string | undefined, message: string) {
    const res = await fetch(`${API}/repos/${r.owner}/${r.repo}/contents/${encPath(path)}`, {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: utf8ToB64(JSON.stringify(data, null, 1)), sha, branch: r.branch }),
    })
    if (res.status === 409 || res.status === 422) throw new Conflict('conflict')
    if (!res.ok) throw await toError(res)
    return (await res.json()).content.sha as string
  }

  /** 최신본을 읽어서 mutate 적용 후 커밋. 동시 저장 충돌 시 자동 재시도 */
  async update<T>(r: Repo, path: string, init: () => T, mutate: (cur: T) => T, message: string, tries = 5): Promise<T> {
    for (let i = 0; i < tries; i++) {
      const cur = await this.get<T>(r, path)
      const next = mutate(cur ? cur.data : init())
      try {
        await this.put(r, path, next, cur?.sha, message)
        return next
      } catch (e) {
        if (e instanceof Conflict && i < tries - 1) { await sleep(500 * (i + 1) + Math.random() * 300); continue }
        if (e instanceof Conflict) throw new Error('다른 사람과 동시에 저장되어 충돌했습니다. 잠시 후 다시 시도하세요.')
        throw e
      }
    }
    throw new Error('저장 실패')
  }
}
