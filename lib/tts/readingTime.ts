const WPM = 200

export function wordCount(text: string): number {
  if (!text) return 0
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  return [...segmenter.segment(text)].filter(s => s.isWordLike).length
}

export function charCount(text: string): number {
  if (!text) return 0
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...segmenter.segment(text)].length
}

export function readingTimeMin(text: string): number {
  if (!text || !text.trim()) return 0
  return Math.max(1, Math.ceil(wordCount(text) / WPM))
}
