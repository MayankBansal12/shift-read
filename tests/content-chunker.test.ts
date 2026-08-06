import { describe, it, expect } from 'vitest'
import { chunkContent, CONTENT_CHUNK_SIZE } from '../lib/content-chunker'

function makeArticle(count: number, wordsPerParagraph: number): string {
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const words = Array.from({ length: wordsPerParagraph }, (_, j) => `word${i}-${j}`).join(' ')
    parts.push(`Paragraph ${i + 1}: ${words}. With more content here to fill it out nicely for testing purposes.`)
  }
  return parts.join('\n\n')
}

describe('chunkContent', () => {
  it('returns single chunk for empty text', () => {
    const result = chunkContent('')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('')
    expect(result[0].index).toBe(0)
  })

  it('returns single chunk for whitespace-only text', () => {
    const result = chunkContent('   \n  \n  ')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('   \n  \n  ')
    expect(result[0].index).toBe(0)
  })

  it('returns single chunk for text under chunk size', () => {
    const text = 'Short article. Only a few sentences here.'
    const result = chunkContent(text)
    expect(result).toHaveLength(1)
    expect(result[0].index).toBe(0)
    expect(result[0].text).toBe(text)
  })

  it('returns single chunk for text exactly at chunk size', () => {
    const text = 'x'.repeat(CONTENT_CHUNK_SIZE)
    const result = chunkContent(text)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe(text)
  })

  it('splits at paragraph boundary when text exceeds chunk size', () => {
    const p1 = 'A'.repeat(3000)
    const p2 = 'B'.repeat(3000)
    const text = `${p1}\n\n${p2}`

    const result = chunkContent(text, 4000)

    expect(result).toHaveLength(2)
    expect(result[0].index).toBe(0)
    expect(result[1].index).toBe(1)
    expect(result[0].text).toBe(p1)
    expect(result[1].text).toBe(p2)
  })

  it('packs paragraphs into chunks under the limit', () => {
    const p1 = 'A'.repeat(1000)
    const p2 = 'B'.repeat(1000)
    const p3 = 'C'.repeat(1000)
    const p4 = 'D'.repeat(1000)
    const text = [p1, p2, p3, p4].join('\n\n')

    const result = chunkContent(text, 2500)

    expect(result).toHaveLength(2)
    expect(result[0].text).toContain('AAAA')
    expect(result[0].text).toContain('BBBB')
    expect(result[1].text).toContain('CCCC')
    expect(result[1].text).toContain('DDDD')
  })

  it('handles a single paragraph exceeding chunk size by splitting at sentences', () => {
    const sentences: string[] = []
    for (let i = 0; i < 20; i++) {
      sentences.push(`This is sentence number ${i + 1} with some additional words to make it longer.`)
    }
    const text = sentences.join(' ')

    const result = chunkContent(text, 500)

    expect(result.length).toBeGreaterThan(1)
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(600)
    }
  })

  it('hard-splits an extremely long sentence at word boundaries', () => {
    const longSentenceWithSpaces = Array.from({ length: 2000 }, () => 'word').join(' ')

    const result = chunkContent(longSentenceWithSpaces, 500)

    expect(result.length).toBeGreaterThan(1)
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(600)
    }
  })

  it('preserves markdown headings in chunks', () => {
    const heading = '## Section Title'
    const paragraph = 'A'.repeat(3000)
    const text = `${heading}\n\n${paragraph}`

    const result = chunkContent(text, 2000)

    expect(result.length).toBeGreaterThan(1)
    expect(result[0].text).toContain('## Section Title')
  })

  it('preserves code blocks within chunks', () => {
    const before = 'Some text before the code block. '.repeat(60)
    const codeBlock = '```\nconst x = 1;\nconsole.log(x);\n```'
    const after = ' More text after the code block. '.repeat(60)
    const text = `${before}\n\n${codeBlock}\n\n${after}`

    const result = chunkContent(text, 1000)

    expect(result.length).toBeGreaterThanOrEqual(2)
    const fullContent = result.map(c => c.text).join('\n\n')
    expect(fullContent).toContain('```\nconst x = 1;')
  })

  it('keeps fenced code containing blank lines in one chunk', () => {
    const codeBlock = `\`\`\`typescript
function first() {
  return 1
}

function second() {
  return 2
}
\`\`\``
    const text = `${'Before. '.repeat(30)}\n\n${codeBlock}\n\n${'After. '.repeat(30)}`

    const result = chunkContent(text, 200)
    const codeChunks = result.filter(chunk => chunk.text.includes('```typescript'))

    expect(codeChunks).toHaveLength(1)
    expect(codeChunks[0].text).toContain('function first()')
    expect(codeChunks[0].text).toContain('function second()')
    expect(codeChunks[0].text.endsWith('```')).toBe(true)
  })

  it('assigns correct sequential indices to chunks', () => {
    const parts: string[] = []
    for (let i = 0; i < 10; i++) {
      parts.push(`Paragraph ${i}: ${'x'.repeat(1400)}`)
    }
    const text = parts.join('\n\n')

    const result = chunkContent(text, 3000)

    for (let i = 0; i < result.length; i++) {
      expect(result[i].index).toBe(i)
    }
  })

  it('returns single chunk for realistic article under 5000 chars', () => {
    const text = `## Introduction

This is a short blog post about web development.

### Why TypeScript?

TypeScript adds static typing to JavaScript. It helps catch errors at compile time.

### Conclusion

TypeScript is a great choice for large projects.`

    const result = chunkContent(text)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe(text)
  })

  it('splits large article into approximately equal chunks', () => {
    const article = makeArticle(50, 25)
    expect(article.length).toBeGreaterThan(CONTENT_CHUNK_SIZE)

    const result = chunkContent(article)

    expect(result.length).toBeGreaterThan(1)

    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(CONTENT_CHUNK_SIZE + 1000)
    }

    const reconstructed = result.map(c => c.text).join('\n\n')
    expect(reconstructed).toBe(article)
  })

  it('handles many small paragraphs packed into few chunks', () => {
    const parts = Array.from({ length: 100 }, (_, i) => `Paragraph ${i + 1}: short text.`)
    const text = parts.join('\n\n')

    const result = chunkContent(text, 200)

    expect(result.length).toBeGreaterThan(1)
    const totalChunks = result.reduce((sum, c) => sum + c.text.length, 0)
    expect(totalChunks + (result.length - 1) * 2).toBeGreaterThanOrEqual(text.length - 10)
  })

  it('handles text with triple newlines between paragraphs', () => {
    const p1 = 'A'.repeat(3000)
    const p2 = 'B'.repeat(3000)
    const text = `${p1}\n\n\n${p2}`

    const result = chunkContent(text, 4000)

    expect(result).toHaveLength(2)
    const reconstructed = result.map(c => c.text).join('\n\n')
    expect(reconstructed).toContain('AAAA')
    expect(reconstructed).toContain('BBBB')
  })

  it('does not produce empty chunks when paragraphs are whitespace-only', () => {
    const p1 = 'A'.repeat(3000)
    const text = `${p1}\n\n   \n\n${'B'.repeat(3000)}`

    const result = chunkContent(text, 4000)

    expect(result.every(c => c.text.length > 0)).toBe(true)
  })
})
