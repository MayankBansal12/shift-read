import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReadPage from '../app/read/[...url]/page'
import { cleanMarkdown } from '../app/actions/cleanMarkdown'
import { fetchContent } from '../app/actions/fetchContent'
import { translateMarkdownChunk } from '../app/actions/translate'
import { getFromStorage, saveToStorage } from '../lib/storage'

const { paramsMock } = vi.hoisted(() => ({
  paramsMock: { url: ['https%3A%2F%2Fexample.com%2Farticle'] }
}))

vi.mock('next/navigation', () => ({
  useParams: () => paramsMock,
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}))

vi.mock('../app/actions/fetchContent', () => ({ fetchContent: vi.fn() }))
vi.mock('../app/actions/cleanMarkdown', () => ({ cleanMarkdown: vi.fn() }))
vi.mock('../app/actions/translate', () => ({ translateMarkdownChunk: vi.fn() }))
vi.mock('../lib/storage', () => ({
  getFromStorage: vi.fn(),
  saveToStorage: vi.fn()
}))
vi.mock('../hooks/useArticleTTS', () => ({
  useArticleTTS: () => ({
    state: { kind: 'idle' },
    audioRef: { current: null },
    chunks: [],
    tooLong: false,
    empty: true,
    words: 0,
    chars: 0,
    readingMinutes: 0,
    volume: 1,
    onToggle: vi.fn(),
    onVolumeChange: vi.fn(),
    onMuteToggle: vi.fn()
  })
}))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/ArticleHeader', () => ({
  default: ({ title }: { title?: string }) => <h1>{title}</h1>
}))
vi.mock('../components/LanguageSelector', () => ({
  default: ({ onLanguageChange }: { onLanguageChange: (language: string) => void }) => (
    <button onClick={() => onLanguageChange('es')}>translate to spanish</button>
  )
}))
vi.mock('../components/ListenToArticle', () => ({ default: () => null }))
vi.mock('../components/MDXRender', () => ({
  MDXRender: ({ content }: { content: string }) => <article>{content}</article>
}))
vi.mock('../components/ui/animate-loader', () => ({ AnimateLoader: () => <div>loading</div> }))
vi.mock('@hugeicons/react', () => ({ HugeiconsIcon: () => null }))

type ObserverCallback = IntersectionObserverCallback

let observerCallback: ObserverCallback | null = null

class IntersectionObserverMock {
  constructor(callback: ObserverCallback) {
    observerCallback = callback
  }

  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() { return [] }
  root = null
  rootMargin = ''
  thresholds = []
}

function intersectSentinel() {
  if (!observerCallback) throw new Error('Observer was not created')
  observerCallback(
    [{ isIntersecting: true } as IntersectionObserverEntry],
    {} as IntersectionObserver
  )
}

describe('progressive reading page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    observerCallback = null
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    vi.mocked(getFromStorage).mockReturnValue(null)
    vi.mocked(translateMarkdownChunk)
      .mockResolvedValueOnce({ success: true, data: 'translated first chunk' })
      .mockResolvedValueOnce({ success: true, data: 'translated second chunk' })
    vi.mocked(fetchContent).mockResolvedValue({
      success: true,
      data: {
        markdown: `${'A'.repeat(3000)}\n\n${'B'.repeat(3000)}`,
        metadata: { title: 'Firecrawl title', language: 'en' }
      }
    })
    vi.mocked(cleanMarkdown)
      .mockResolvedValueOnce({
        success: true,
        data: {
          markdown: 'formatted first chunk',
          metadata: { title: 'Formatted title', language: 'en' }
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: { markdown: 'formatted second chunk', metadata: { language: 'en' } }
      })
  })

  it('formats only the first chunk initially and loads the next near the sentinel', async () => {
    render(<ReadPage />)

    expect(await screen.findByText('formatted first chunk')).toBeTruthy()
    expect(cleanMarkdown).toHaveBeenCalledTimes(1)
    expect(cleanMarkdown).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({ title: 'Firecrawl title' }),
      { index: 0, total: 2 }
    )
    expect(screen.queryByRole('button', { name: /read more/i })).toBeNull()

    await act(async () => intersectSentinel())

    expect(await screen.findByText('formatted second chunk')).toBeTruthy()
    expect(cleanMarkdown).toHaveBeenCalledTimes(2)
    expect(cleanMarkdown).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ title: 'Formatted title' }),
      { index: 1, total: 2 }
    )
    expect(saveToStorage).toHaveBeenLastCalledWith(
      'https://example.com/article',
      expect.objectContaining({
        version: 2,
        article: expect.objectContaining({
          formattedChunks: ['formatted first chunk', 'formatted second chunk']
        })
      })
    )
  })

  it('resumes a partially formatted article from cache without scraping again', async () => {
    vi.mocked(getFromStorage).mockReturnValue({
      version: 2,
      article: {
        rawChunks: ['raw first', 'raw second'],
        formattedChunks: ['cached first'],
        title: 'Cached title',
        sourceLanguage: 'en'
      },
      timestamp: Date.now()
    })
    vi.mocked(cleanMarkdown).mockReset().mockResolvedValue({
      success: true,
      data: { markdown: 'formatted from cached raw', metadata: { language: 'en' } }
    })

    render(<ReadPage />)

    expect(await screen.findByText('cached first')).toBeTruthy()
    expect(fetchContent).not.toHaveBeenCalled()

    await waitFor(() => expect(observerCallback).not.toBeNull())
    await act(async () => intersectSentinel())

    expect(await screen.findByText('formatted from cached raw')).toBeTruthy()
    expect(cleanMarkdown).toHaveBeenCalledWith(
      'raw second',
      expect.objectContaining({ title: 'Cached title' }),
      { index: 1, total: 2 }
    )
  })

  it('translates loaded chunks and translates newly formatted chunks before displaying them', async () => {
    render(<ReadPage />)

    expect(await screen.findByText('formatted first chunk')).toBeTruthy()
    await act(async () => screen.getByRole('button', { name: 'translate to spanish' }).click())

    expect(await screen.findByText('translated first chunk')).toBeTruthy()
    expect(screen.queryByText('formatted first chunk')).toBeNull()

    await waitFor(() => expect(observerCallback).not.toBeNull())
    await act(async () => intersectSentinel())

    expect(await screen.findByText('translated second chunk')).toBeTruthy()
    expect(translateMarkdownChunk).toHaveBeenNthCalledWith(1, 'formatted first chunk', 'en', 'es')
    expect(translateMarkdownChunk).toHaveBeenNthCalledWith(2, 'formatted second chunk', 'en', 'es')
  })
})
