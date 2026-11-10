import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchContent } from '@/app/actions/fetchContent'

const mocks = vi.hoisted(() => ({ scrape: vi.fn() }))

vi.mock('@mendable/firecrawl-js', () => ({
  default: class {
    scrape = mocks.scrape
  }
}))

describe('article extraction with Firecrawl v2', () => {
  beforeEach(() => {
    mocks.scrape.mockReset()
    vi.stubEnv('FIRECRAWL_API_KEY', 'fc-test-key')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('accepts a v2 document without a success field and preserves article metadata', async () => {
    const article = {
      markdown: '# Article\n\nReadable content.',
      metadata: {
        title: 'Article',
        subheading: 'A subtitle',
        author: 'Author',
        publishedTime: '2026-11-10',
        ogImage: 'https://example.com/cover.jpg',
        language: 'en'
      }
    }
    mocks.scrape.mockResolvedValue(article)

    await expect(fetchContent('https://example.com/article')).resolves.toEqual({
      success: true,
      data: article
    })
    expect(mocks.scrape).toHaveBeenCalledExactlyOnceWith('https://example.com/article', {
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 1000
    })
  })

  it('accepts article content when metadata is absent', async () => {
    mocks.scrape.mockResolvedValue({ markdown: 'Article content' })

    const result = await fetchContent('https://example.com/article')

    expect(result.success).toBe(true)
    expect(result.data?.markdown).toBe('Article content')
    expect(result.data?.metadata.title).toBeUndefined()
  })

  it.each([undefined, ''])('rejects missing or empty markdown (%s)', async (markdown) => {
    mocks.scrape.mockResolvedValue({ markdown })

    await expect(fetchContent('https://example.com/article')).resolves.toEqual({
      success: false,
      error: 'Failed to extract article content'
    })
  })

  it('turns a thrown SDK error into an action failure', async () => {
    mocks.scrape.mockRejectedValue(new Error('Insufficient credits'))

    await expect(fetchContent('https://example.com/article')).resolves.toEqual({
      success: false,
      error: 'Insufficient credits'
    })
  })

  it('handles a rejection without an Error instance', async () => {
    mocks.scrape.mockRejectedValue('Unavailable')

    await expect(fetchContent('https://example.com/article')).resolves.toEqual({
      success: false,
      error: 'Failed to scrape article'
    })
  })

  it('does not call Firecrawl when the API key is missing', async () => {
    vi.stubEnv('FIRECRAWL_API_KEY', undefined)

    await expect(fetchContent('https://example.com/article')).resolves.toEqual({
      success: false,
      error: 'Firecrawl API key is not configured'
    })
    expect(mocks.scrape).not.toHaveBeenCalled()
  })
})
