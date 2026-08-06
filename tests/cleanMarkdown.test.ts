import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { cleanMarkdown } from '../app/actions/cleanMarkdown'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => () => ({})
}))
vi.mock('../lib/json-error-logger', () => ({ logJsonParseError: vi.fn() }))

function mockCleanupResponse(content: string, isComplete: boolean) {
  vi.mocked(generateText).mockResolvedValue({
    text: JSON.stringify({
      content,
      warnings: [],
      isComplete,
      metadata: {
        title: 'Article title',
        subheading: null,
        author: null,
        publishedTime: null,
        ogImage: null
      }
    }),
    finishReason: 'stop',
    usage: { outputTokens: 100 }
  } as Awaited<ReturnType<typeof generateText>>)
}

describe('chunk cleanup acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts non-empty cleaned content when the model marks a partial chunk incomplete', async () => {
    mockCleanupResponse('## A valid formatted section\n\nReadable content.', false)

    const result = await cleanMarkdown('raw content', {}, { index: 0, total: 4 })

    expect(result.success).toBe(true)
    expect(result.data?.markdown).toContain('Readable content.')
  })

  it('rejects an empty first chunk', async () => {
    mockCleanupResponse('', false)

    const result = await cleanMarkdown('raw content', {}, { index: 0, total: 4 })

    expect(result).toEqual({
      success: false,
      error: 'Could not extract meaningful content from the article'
    })
  })

  it('accepts an empty later chunk so promotional-only content can be skipped', async () => {
    mockCleanupResponse('', true)

    const result = await cleanMarkdown('subscribe now', {}, { index: 3, total: 4 })

    expect(result.success).toBe(true)
    expect(result.data?.markdown).toBe('')
  })
})
