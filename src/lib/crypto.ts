// 공용 GitHub 토큰 보호
// - 토큰은 랜덤 데이터키(AES-256-GCM)로 암호화되어 auth.json에 저장
// - 데이터키는 담당자별 비밀번호(PBKDF2 31만회)로 각각 암호화되어 저장
// - 로그인 = 내 비밀번호로 데이터키 복호화 → 토큰 복호화
// - 토큰 교체 시 데이터키로만 다시 암호화하면 되므로 담당자 비밀번호 재설정 불필요

const enc = new TextEncoder()
const dec = new TextDecoder()
const ITER = 310000

export const b64 = (u: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s)
}
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const bs = (u: Uint8Array) => u as unknown as BufferSource

async function pwKey(pw: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', bs(enc.encode(pw)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}
const aesKey = (raw: Uint8Array) => crypto.subtle.importKey('raw', bs(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])

export const newDataKey = () => rand(32)

export async function wrapDataKey(dataKey: Uint8Array, pw: string) {
  const salt = rand(16)
  const iv = rand(12)
  const k = await pwKey(pw, salt)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, k, bs(dataKey)))
  return { salt: b64(salt), iv: b64(iv), wrapped: b64(ct) }
}

/** 비밀번호가 틀리면 예외 발생 */
export async function unwrapDataKey(m: { salt?: string; iv?: string; wrapped?: string }, pw: string) {
  if (!m.salt || !m.iv || !m.wrapped) throw new Error('비밀번호가 설정되지 않은 담당자입니다.')
  const k = await pwKey(pw, unb64(m.salt))
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(unb64(m.iv)) }, k, bs(unb64(m.wrapped))))
}

export async function encryptToken(dataKey: Uint8Array, token: string) {
  const iv = rand(12)
  const k = await aesKey(dataKey)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, k, bs(enc.encode(token))))
  return { tokenIv: b64(iv), tokenCt: b64(ct) }
}

export async function decryptToken(dataKey: Uint8Array, tokenIv: string, tokenCt: string) {
  const k = await aesKey(dataKey)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(unb64(tokenIv)) }, k, bs(unb64(tokenCt)))
  return dec.decode(pt)
}
