const WPM = 230

export function wordCount(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function charCount(text: string): number {
  if (!text) return 0
  return text.length
}

export function readingTimeMin(text: string): number {
  if (!text || !text.trim()) return 0
  return Math.max(1, Math.ceil(wordCount(text) / WPM))
}
