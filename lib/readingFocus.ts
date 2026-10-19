export interface ReadingWord {
  text: string
  range: Range
}

const skippedElements = 'pre, code, button, input, textarea, select, svg, video, audio, iframe, script, style, [hidden], [aria-hidden="true"]'
const blockElements = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, dt, dd'

export function collectReadingWords(root: HTMLElement, language?: string): ReadingWord[] {
  let segmenter: Intl.Segmenter | undefined
  if (typeof Intl.Segmenter === 'function') {
    try {
      segmenter = new Intl.Segmenter(language || undefined, { granularity: 'word' })
    } catch {
      segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    }
  }

  const words: ReadingWord[] = []
  let nodes: { node: Text; start: number; end: number }[] = []
  let text = ''
  let block: Element | null = null

  function flush() {
    const segments = segmenter
      ? Array.from(segmenter.segment(text)).filter(segment => segment.isWordLike)
      : Array.from(text.matchAll(/[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu), match => ({
          segment: match[0],
          index: match.index
        }))
    let nodeIndex = 0
    for (const segment of segments) {
      const start = segment.index
      const end = start + segment.segment.length
      while (nodeIndex < nodes.length && nodes[nodeIndex].end <= start) nodeIndex++
      const first = nodes[nodeIndex]
      let lastIndex = nodeIndex
      while (lastIndex < nodes.length - 1 && nodes[lastIndex].end < end) lastIndex++
      const last = nodes[lastIndex]
      if (!first || !last) continue
      const range = root.ownerDocument.createRange()
      range.setStart(first.node, start - first.start)
      range.setEnd(last.node, end - last.start)
      words.push({ text: segment.segment, range })
    }
    nodes = []
    text = ''
  }

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as Element).matches('br, hr')) flush()
      node = walker.nextNode()
      continue
    }
    const parent = node.parentElement
    if (parent && !parent.closest(skippedElements)) {
      const nextBlock = parent.closest(blockElements) ?? root
      if (nextBlock !== block) {
        flush()
        block = nextBlock
      }
      const value = node.textContent ?? ''
      nodes.push({ node: node as Text, start: text.length, end: text.length + value.length })
      text += value
    } else {
      flush()
      block = null
    }
    node = walker.nextNode()
  }
  flush()
  return words
}

export function isPointInWord(word: ReadingWord, x: number, y: number, slop = 0): boolean {
  return Array.from(word.range.getClientRects()).some(rect => (
    x >= rect.left - slop && x <= rect.right + slop && y >= rect.top - slop && y <= rect.bottom + slop
  ))
}

export function wordAtPoint(words: ReadingWord[], x: number, y: number): number {
  return words.findIndex(word => isPointInWord(word, x, y))
}

function sharesLine(a: DOMRect, b: DOMRect) {
  return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > Math.min(a.height, b.height) / 2
}

export function wordOnAdjacentLine(words: ReadingWord[], index: number, direction: -1 | 1, preferredX?: number) {
  const rects = words[index] ? getReadingWordRects(words[index]) : []
  const anchor = direction === 1 ? rects.at(-1) : rects[0]
  if (!anchor) return null
  const x = preferredX ?? anchor.left + anchor.width / 2
  const candidates = words.flatMap((word, wordIndex) => wordIndex === index ? [] : getReadingWordRects(word)
    .filter(rect => direction === 1 ? rect.top >= anchor.bottom - 1 : rect.bottom <= anchor.top + 1)
    .map(rect => ({ index: wordIndex, rect })))
  let line: DOMRect | undefined
  for (const { rect } of candidates) {
    if (!line || (direction === 1 ? rect.top < line.top : rect.bottom > line.bottom)) line = rect
  }
  let nextIndex = index
  let distance = Infinity
  for (const candidate of candidates) {
    if (!line || !sharesLine(candidate.rect, line)) continue
    const horizontalDistance = Math.max(candidate.rect.left - x, x - candidate.rect.right, 0)
    if (horizontalDistance < distance) {
      distance = horizontalDistance
      nextIndex = candidate.index
    }
  }
  return { index: nextIndex, x }
}

export function getReadingWordRects(word: ReadingWord): DOMRect[] {
  const result: DOMRect[] = []
  for (const rect of Array.from(word.range.getClientRects()).sort((a, b) => a.top - b.top || a.left - b.left)) {
    if (rect.width <= 0 || rect.height <= 0) continue
    const index = result.findIndex(previous => (
      sharesLine(previous, rect) && rect.left <= previous.right + 1 && rect.right >= previous.left - 1
    ))
    if (index < 0) result.push(new DOMRect(rect.left, rect.top, rect.width, rect.height))
    else {
      const previous = result[index]
      const left = Math.min(previous.left, rect.left)
      const top = Math.min(previous.top, rect.top)
      result[index] = new DOMRect(left, top, Math.max(previous.right, rect.right) - left, Math.max(previous.bottom, rect.bottom) - top)
    }
  }
  return result
}
