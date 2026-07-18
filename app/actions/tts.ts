'use server'

import { createHash } from 'crypto'

const VOICE_WHITELIST = new Set(['diana'])
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/speech'
const MAX_INPUT = 1100
const TIMEOUT_MS = 30_000
const SERVER_CACHE_MAX = 50

type Result =
  | { success: true; blob: Blob; mimeType: string; cached: boolean }
  | { success: false; error: string; status?: number }

const serverCache = new Map<string, Blob>()

export async function synthesizeSpeech(input: {
  text: string
  voice?: string
}): Promise<Result> {
  const text = (input.text ?? '').trim()
  if (text.length > MAX_INPUT) {
    return { success: false, error: `Input exceeds ${MAX_INPUT} chars` }
  }
  const voice = input.voice ?? 'diana'
  if (!VOICE_WHITELIST.has(voice)) {
    return { success: false, error: `Unknown voice: ${voice}` }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { success: false, error: 'Groq API key not configured' }

  const cacheKey = createHash('sha256').update(`${voice}|${text}`).digest('hex')
  const cached = serverCache.get(cacheKey)
  if (cached) {
    serverCache.delete(cacheKey)
    serverCache.set(cacheKey, cached)
    return { success: true, blob: cached, mimeType: 'audio/wav', cached: true }
  }
  if (serverCache.size >= SERVER_CACHE_MAX) {
    const firstKey = serverCache.keys().next().value
    if (firstKey !== undefined) serverCache.delete(firstKey)
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/wav',
      },
      body: JSON.stringify({
        model: 'canopylabs/orpheus-v1-english',
        input: text,
        voice,
        response_format: 'wav',
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return {
        success: false,
        error: `Groq ${res.status}: ${errBody.slice(0, 200) || res.statusText}`,
        status: res.status,
      }
    }
    const buf = await res.arrayBuffer()
    const blob = new Blob([buf], { type: 'audio/wav' })
    serverCache.set(cacheKey, blob)
    return { success: true, blob, mimeType: 'audio/wav', cached: false }
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { success: false, error: 'TTS request timed out' }
    }
    return { success: false, error: (e as Error).message }
  } finally {
    clearTimeout(t)
  }
}
