import { describe, expect, it } from 'vitest'
import { stripMarkdown } from '@/lib/tts/stripMarkdown'

describe('stripMarkdown', () => {
  it('removes fenced code blocks', () => {
    const out = stripMarkdown('Hello.\n```js\nconst x = 1;\n```\nWorld.')
    expect(out).not.toContain('const x = 1;')
    expect(out).toContain('Hello.')
    expect(out).toContain('World.')
  })

  it('removes inline code', () => {
    const out = stripMarkdown('Use the `npm` command to install.')
    expect(out).not.toContain('`npm`')
    expect(out).toContain('Use the')
    expect(out).toContain('command to install.')
  })

  it('removes image syntax', () => {
    const out = stripMarkdown('A nice image: ![alt text](https://x.com/y.png) here.')
    expect(out).not.toContain('https://x.com/y.png')
    expect(out).not.toContain('![')
    expect(out).toContain('A nice image:')
  })

  it('converts [label](url) to label', () => {
    const out = stripMarkdown('Read [the docs](https://example.com) for more.')
    expect(out).toContain('the docs')
    expect(out).not.toContain('https://example.com')
    expect(out).not.toContain('[')
  })

  it('removes bare <https://…> autolinks', () => {
    const out = stripMarkdown('See <https://example.com> for context.')
    expect(out).not.toContain('https://example.com')
    expect(out).not.toContain('<')
    expect(out).toContain('See')
    expect(out).toContain('for context.')
  })

  it('strips heading hashes', () => {
    const out = stripMarkdown('# Title\n## Subtitle\n### Sub-sub\nBody.')
    expect(out).not.toContain('#')
    expect(out).toContain('Title')
    expect(out).toContain('Subtitle')
    expect(out).toContain('Sub-sub')
  })

  it('strips blockquote > prefixes', () => {
    const out = stripMarkdown('> This is a quote\n> spanning lines.')
    expect(out).not.toMatch(/^>/m)
    expect(out).toContain('This is a quote')
    expect(out).toContain('spanning lines.')
  })

  it('collapses multiple blank lines into two newlines', () => {
    const out = stripMarkdown('Line 1.\n\n\n\n\nLine 2.')
    expect(out).not.toMatch(/\n{3,}/)
  })
})
