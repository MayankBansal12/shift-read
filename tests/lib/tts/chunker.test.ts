import { describe, expect, it } from 'vitest'
import { ArticleTooLongError, chunkText } from '@/lib/tts/chunker'

describe('chunkText', () => {
  it('returns [] for empty input', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns [] for whitespace-only input', () => {
    expect(chunkText('   \n\t  ')).toEqual([])
  })

  it('returns one chunk for a single short sentence', () => {
    const out = chunkText('Hello world.')
    expect(out).toEqual(['Hello world.'])
  })

  it('packs 20 short sentences (1500 chars) into multiple chunks under SOFT_LIMIT', () => {
    const sentence = 'This is a moderately sized sentence with several words in it. '
    const text = sentence.repeat(20).trim()
    expect(text.length).toBeLessThan(2200)
    const out = chunkText(text)
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) {
      expect(c.length).toBeLessThanOrEqual(1100)
    }
  })

  it('chunks 20 long sentences (4500 chars total) under HARD_LIMIT each', () => {
    const sentence = 'This sentence is intentionally constructed to be long enough to consume meaningful characters toward the soft and hard limits, but not too long. '
    const text = sentence.repeat(20).trim()
    const out = chunkText(text)
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) {
      expect(c.length).toBeLessThanOrEqual(2500)
    }
  })

  it('hard-cases a single 3000-char sentence: splits on commas, then hard-split', () => {
    const parts: string[] = []
    for (let i = 0; i < 60; i++) {
      parts.push(`segment number ${i} is a clause with some text`)
    }
    const long = parts.join(', ')
    expect(long.length).toBeGreaterThan(2500)
    const out = chunkText(long)
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) {
      expect(c.length).toBeLessThanOrEqual(3000)
    }
  })

  it('hard-splits a 5000-char wall of text with no sentence boundaries', () => {
    const wall = 'word'.repeat(1250)
    expect(wall.length).toBeGreaterThanOrEqual(5000)
    const out = chunkText(wall)
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) {
      expect(c.length).toBeLessThanOrEqual(2500)
    }
  })

  it('throws ArticleTooLongError when input exceeds MAX_TOTAL_CHARS', () => {
    const big = 'a'.repeat(200_001)
    expect(() => chunkText(big)).toThrow(ArticleTooLongError)
  })

  it('reduces a markdown-syntax-only article to [] (after strip)', () => {
    const md = [
      '```js',
      'const x = 1;',
      'console.log(x);',
      '```',
      '![hero image](https://example.com/x.png)',
      '| --- | --- |',
      '| --- | --- |',
    ].join('\n')
    const out = chunkText(md)
    expect(out.length).toBe(0)
  })

  it('handles "Dr. Smith said. He left." as 2 sentences, not 3', () => {
    const out = chunkText('Dr. Smith said. He left.')
    expect(out.length).toBe(1)
    expect(out[0]).toContain('Dr. Smith said.')
    expect(out[0]).toContain('He left.')
  })

  it('hard-splits a long single sentence with no good break points', () => {
    const long = 'This is a really long sentence, ' + 'word '.repeat(600)
    const out = chunkText(long)
    expect(out.length).toBeGreaterThan(1)
    for (const c of out) {
      expect(c.length).toBeLessThanOrEqual(2500)
    }
  })
})
