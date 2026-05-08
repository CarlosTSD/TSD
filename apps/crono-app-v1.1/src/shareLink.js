// Encode/decode dados do cronograma em base64 URL-safe.
// Usado pra montar links auto-contidos: ?view=BASE64DATA — sem backend.

function bytesToBase64Url(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function encodeShareData(payload) {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  return bytesToBase64Url(bytes)
}

export function decodeShareData(str) {
  const bytes = base64UrlToBytes(str)
  const json = new TextDecoder().decode(bytes)
  return JSON.parse(json)
}

// Constrói a URL completa para compartilhamento, preservando origin + pathname
export function buildShareUrl(payload) {
  const data = encodeShareData(payload)
  const { origin, pathname } = window.location
  return `${origin}${pathname}?view=${data}`
}

// Lê o parâmetro ?view= da URL atual (null se ausente ou inválido)
export function readShareFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const v = params.get('view')
  if (!v) return null
  try { return decodeShareData(v) } catch { return null }
}

// Canal de sincronização entre o admin e a landing (mesmo browser).
// Quando o admin altera o cronograma, faz postMessage; a landing escuta
// e atualiza em tempo real sem precisar regenerar/reabrir o link.
export const SHARE_CHANNEL = 'crono-app-v1.1:share-sync'

export function openShareChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  return new BroadcastChannel(SHARE_CHANNEL)
}
