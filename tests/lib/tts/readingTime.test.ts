import { describe, expect, it } from 'vitest'
import { charCount, readingTimeMin, wordCount } from '@/lib/tts/readingTime'

describe('readingTime helpers', () => {
  it('handles empty input', () => {
    expect(wordCount('')).toBe(0)
    expect(charCount('')).toBe(0)
    expect(readingTimeMin('')).toBe(0)
  })

  it('handles whitespace-only input', () => {
    expect(wordCount('   \n\t ')).toBe(0)
    expect(readingTimeMin('   \n\t ')).toBe(0)
  })

  it('counts 230 words as 1 minute', () => {
    const text = Array.from({ length: 230 }, () => 'word').join(' ')
    expect(wordCount(text)).toBe(230)
    expect(readingTimeMin(text)).toBe(1)
  })

  it('counts 460 words as 2 minutes', () => {
    const text = Array.from({ length: 460 }, () => 'word').join(' ')
    expect(wordCount(text)).toBe(460)
    expect(readingTimeMin(text)).toBe(2)
  })

  it('rounds 461 words up to 3 minutes', () => {
    const text = Array.from({ length: 461 }, () => 'word').join(' ')
    expect(readingTimeMin(text)).toBe(3)
  })

  it('always reports at least 1 minute for any non-empty text', () => {
    expect(readingTimeMin('hi')).toBe(1)
  })

  it('counts characters including whitespace', () => {
    expect(charCount('abc def')).toBe(7)
  })

  it('handles repeated whitespace between words', () => {
    expect(wordCount('a   b\tc\n\nd')).toBe(4)
  })
})
