'use server'

import sharp from 'sharp'
import {
  extractImages,
  extractTextItems,
  getDocumentProxy,
  getMeta,
  type StructuredTextItem,
} from 'unpdf'

export interface ParsedPdf {
  markdown: string
  images: string[]
  metadata: {
    title?: string
    author?: string
    publishedTime?: string
  }
}

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MIN_IMAGE_DIM = 100
const LINE_Y_TOLERANCE = 2

interface Line {
  y: number
  fontSize: number
  allBold: boolean
  text: string
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function groupIntoLines(items: StructuredTextItem[]): Line[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => b.y - a.y)

  const groups: StructuredTextItem[][] = [[sorted[0]]]
  let prevY = sorted[0].y
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i]
    if (Math.abs(prevY - it.y) > LINE_Y_TOLERANCE) {
      groups.push([it])
    } else {
      groups[groups.length - 1].push(it)
    }
    prevY = it.y
  }

  return groups.map((group) => {
    const xSorted = [...group].sort((a, b) => a.x - b.x)
    const text = xSorted.reduce((acc, it, idx) => {
      if (idx === 0) return it.str
      const prev = xSorted[idx - 1]
      const gap = it.x - (prev.x + prev.width)
      return acc + (gap > 1 ? ' ' : '') + it.str
    }, '')
    const fontSize = Math.max(...group.map((g) => g.fontSize))
    const allBold = group.length > 0 && group.every((g) => /bold|black|heavy/i.test(g.fontFamily))
    return { y: group[0].y, fontSize, allBold, text }
  })
}

async function encodeImage(img: {
  data: Uint8ClampedArray
  width: number
  height: number
  channels: 1 | 3 | 4
}): Promise<string | null> {
  if (img.width < MIN_IMAGE_DIM || img.height < MIN_IMAGE_DIM) return null
  const buf = await sharp(Buffer.from(img.data), {
    raw: { width: img.width, height: img.height, channels: img.channels },
  })
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

function renderLine(line: Line, bodySize: number): string {
  const text = line.text.trim()
  if (!text) return ''
  const ratio = line.fontSize / bodySize
  if (ratio >= 2) return `# ${text}`
  if (ratio >= 1.5) return `## ${text}`
  if (ratio >= 1.25) return `### ${text}`
  if (line.allBold) return `**${text}**`
  return text
}

export async function parsePdf(
  file: Uint8Array,
): Promise<{ success: boolean; data?: ParsedPdf; error?: string }> {
  try {
    if (file.byteLength > MAX_FILE_BYTES) {
      return { success: false, error: 'PDF exceeds the 25 MB size limit' }
    }

    const pdf = await getDocumentProxy(file)
    const metaResult = await getMeta(pdf, { parseDates: true }).catch(() => null)
    const info: Record<string, unknown> = metaResult?.info ?? {}
    const { items: pages } = await extractTextItems(pdf)

    const allSizes: number[] = []
    for (const page of pages) for (const it of page) allSizes.push(it.fontSize)
    const bodySize = median(allSizes) || 12

    const blocks: string[] = []
    const images: string[] = []

    for (let p = 0; p < pages.length; p++) {
      const lines = groupIntoLines(pages[p])

      for (let i = 0; i < lines.length; i++) {
        const rendered = renderLine(lines[i], bodySize)
        if (rendered) blocks.push(rendered)

        const next = lines[i + 1]
        if (!next || lines[i].y - next.y > lines[i].fontSize * 1.5) {
          blocks.push('')
        }
      }

      const imgs = await extractImages(pdf, p + 1).catch(() => [])
      for (const img of imgs) {
        const dataUrl = await encodeImage(img).catch(() => null)
        if (dataUrl) {
          const idx = images.length
          images.push(dataUrl)
          blocks.push(`[img:${idx}]`, '')
        }
      }

      if (p < pages.length - 1 && blocks[blocks.length - 1] !== '') {
        blocks.push('---', '')
      }
    }

    const markdown = blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim()

    const creationDate = info.CreationDate
    const publishedTime =
      creationDate instanceof Date ? creationDate.toISOString() : undefined

    return {
      success: true,
      data: {
        markdown,
        images,
        metadata: {
          title: typeof info.Title === 'string' ? info.Title : undefined,
          author: typeof info.Author === 'string' ? info.Author : undefined,
          publishedTime,
        },
      },
    }
  } catch (err) {
    console.error('PDF parse error:', err)
    return { success: false, error: 'Failed to parse PDF' }
  }
}