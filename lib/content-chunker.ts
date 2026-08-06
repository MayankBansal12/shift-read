export const CONTENT_CHUNK_SIZE = 5000

export interface ContentChunk {
  text: string
  index: number
}

const PARAGRAPH_SPLIT = /\n{2,}/

function extractSentences(text: string): string[] {
  const SENT_END = /(?<=[.!?])(?=\s+[A-Z\p{Lu}"'(\[#*_`~>|]|$)/u
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
    out.push(candidate.trim())

    i = absoluteMatch
    const ws = text.slice(i).match(/^\s+/)
    if (ws) i += ws[0].length
    sentStart = i
  }

  return out.filter(s => s.length > 0)
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

function splitLongBlock(block: string, maxSize: number): string[] {
  if (block.length <= maxSize) return [block]

  const sents = extractSentences(block)
  const chunks: string[] = []
  let cur = ''

  for (const s of sents) {
    if (s.length > maxSize) {
      if (cur.length > 0) {
        chunks.push(cur)
        cur = ''
      }
      for (const piece of hardSplit(s, maxSize)) {
        if (piece.length > 0) chunks.push(piece)
      }
      continue
    }

    const tentative = cur.length === 0 ? s.length : cur.length + 2 + s.length
    if (tentative <= maxSize) {
      cur = cur.length === 0 ? s : `${cur}\n\n${s}`
    } else {
      if (cur.length > 0) chunks.push(cur)
      cur = s
    }
  }

  if (cur.length > 0) chunks.push(cur)
  return chunks
}

export function chunkContent(text: string, maxSize: number = CONTENT_CHUNK_SIZE): ContentChunk[] {
  if (!text || text.trim() === '') return [{ text, index: 0 }]

  if (text.length <= maxSize) return [{ text, index: 0 }]

  const paragraphs = text.split(PARAGRAPH_SPLIT)
  const chunks: ContentChunk[] = []
  let currentChunk = ''
  let chunkIndex = 0

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue

    if (paragraph.length > maxSize) {
      if (currentChunk.length > 0) {
        chunks.push({ text: currentChunk, index: chunkIndex++ })
        currentChunk = ''
      }

      for (const piece of splitLongBlock(paragraph, maxSize)) {
        if (piece.length > 0) {
          chunks.push({ text: piece, index: chunkIndex++ })
        }
      }
      continue
    }

    const separator = currentChunk.length > 0 ? '\n\n' : ''
    const tentative = currentChunk.length + separator.length + paragraph.length

    if (tentative <= maxSize) {
      currentChunk += separator + paragraph
    } else {
      chunks.push({ text: currentChunk, index: chunkIndex++ })
      currentChunk = paragraph
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({ text: currentChunk, index: chunkIndex })
  }

  return chunks
}
