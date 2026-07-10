import { ArticleTooLongError, stripMarkdown } from './stripMarkdown'
import { HARD_LIMIT, SOFT_LIMIT, MAX_TOTAL_CHARS } from './constants'

export { ArticleTooLongError }

const ABBREV = new Set<string>([
  'Mr',
  'Mrs',
  'Ms',
  'Dr',
  'Prof',
  'Sr',
  'Jr',
  'St',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'U.S',
  'U.K',
  'U.S.A',
])

const SENT_END = /(?<=[.!?])(?=\s+[A-Z\p{Lu}"'(\[]|$)/u

function extractSentences(text: string): string[] {
  const out: string[] = []
  let sentStart = 0
  let i = 0

  while (i < text.length) {
    const rest = text.slice(i)
    const m = SENT_END.exec(rest)
    if (!m) {
      const tail = text.slice(sentStart).trim()
      if (tail.length > 0) out.push(tail)
      break
    }

    const absoluteMatch = i + m.index
    const candidate = text.slice(sentStart, absoluteMatch)
    const lastWordMatch = candidate.match(/[\p{L}\.']+$/u)
    const lastWord = (lastWordMatch?.[0] ?? '').replace(/^\.+|\.+$/g, '')

    if (ABBREV.has(lastWord) && candidate.length > 0) {
      i = absoluteMatch
      const ws = text.slice(i).match(/^\s+/)
      if (ws) i += ws[0].length
      continue
    }

    out.push(candidate.trim())
    i = absoluteMatch
    const ws2 = text.slice(i).match(/^\s+/)
    if (ws2) i += ws2[0].length
    sentStart = i
  }

  return out.filter(s => s.length > 0)
}

function packByHardLimit(parts: string[], limit: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const p of parts) {
    const tentative = cur.length === 0 ? p.length : cur.length + 1 + p.length
    if (tentative <= limit) {
      cur = cur.length === 0 ? p : `${cur} ${p}`
    } else {
      if (cur.length > 0) out.push(cur)
      cur = p
    }
  }
  if (cur.length > 0) out.push(cur)
  return out
}

function hardSplit(s: string, limit: number): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    let end = Math.min(i + limit, s.length)
    if (end < s.length) {
      const j = s.lastIndexOf(' ', end)
      if (j > i + limit - 200) end = j
    }
    out.push(s.slice(i, end).trim())
    i = end
  }
  return out.filter(p => p.length > 0)
}

function splitLongSentence(s: string): string[] {
  if (s.length <= HARD_LIMIT) return [s]
  const parts = s.split(/(?<=[,;])\s+/)
  if (parts.length > 1 && parts.every(p => p.length <= HARD_LIMIT)) {
    return packByHardLimit(parts, HARD_LIMIT)
  }
  return hardSplit(s, HARD_LIMIT)
}

export function chunkText(rawText: string): string[] {
  if (!rawText || rawText.trim() === '') return []
  if (rawText.length > MAX_TOTAL_CHARS) {
    throw new ArticleTooLongError(rawText.length)
  }

  const text = stripMarkdown(rawText)
  if (text === '') return []

  const sents = extractSentences(text)
  const chunks: string[] = []
  let cur = ''

  for (const s of sents) {
    if (s.length > HARD_LIMIT) {
      if (cur.length > 0) {
        chunks.push(cur)
        cur = ''
      }
      for (const piece of splitLongSentence(s)) {
        if (piece.length > 0) chunks.push(piece)
      }
      continue
    }

    const tentative = cur.length === 0 ? s.length : cur.length + 1 + s.length
    if (tentative <= SOFT_LIMIT) {
      cur = cur.length === 0 ? s : `${cur} ${s}`
    } else {
      if (cur.length > 0) chunks.push(cur)
      cur = s
    }
  }

  if (cur.length > 0) chunks.push(cur)
  return chunks
}
