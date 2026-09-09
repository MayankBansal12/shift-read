import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanMarkdown } from '../app/actions/cleanMarkdown'
import { normalizeSessionId } from '../lib/session'

const mocks = vi.hoisted(() => {
  const provider = vi.fn(() => ({}))
  return {
    provider,
    createAnthropic: vi.fn(() => provider),
    generateText: vi.fn()
  }
})

vi.mock('ai', () => ({ generateText: mocks.generateText }))
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: mocks.createAnthropic }))
vi.mock('../lib/json-error-logger', () => ({ logJsonParseError: vi.fn() }))

const generateTextMock = mocks.generateText as ReturnType<typeof vi.fn>

function mockCleanupResponse(content: string, isComplete: boolean) {
  generateTextMock.mockResolvedValue({
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
  })
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

describe('opencode go session headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('identifies as shift and forwards a valid session id', async () => {
    mockCleanupResponse('clean', true)
    const sessionId = 'c0a80101-0000-4000-8000-000000000000'

    await cleanMarkdown('raw content', {}, { index: 0, total: 1 }, sessionId)

    expect(mocks.createAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'User-Agent': 'shift/1.0',
          'x-opencode-session': sessionId
        }
      })
    )
  })

  it('falls back to a generated uuid for invalid session ids', async () => {
    mockCleanupResponse('clean', true)

    await cleanMarkdown('raw content', {}, { index: 0, total: 1 }, 'not-a-uuid')

    expect(mocks.createAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'User-Agent': 'shift/1.0',
          'x-opencode-session': expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          )
        }
      })
    )
    expect(normalizeSessionId('not-a-uuid')).not.toBe('not-a-uuid')
    expect(normalizeSessionId()).toMatch(/^[0-9a-f]{8}-/)
  })
})
