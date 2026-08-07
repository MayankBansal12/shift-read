'use client'

import { cleanMarkdown } from '@/app/actions/cleanMarkdown'
import { fetchContent, type ArticleData } from '@/app/actions/fetchContent'
import { translateMarkdownChunk } from '@/app/actions/translate'
import ArticleHeader from '@/components/ArticleHeader'
import LanguageSelector from '@/components/LanguageSelector'
import ListenToArticle from '@/components/ListenToArticle'
import { MDXRender } from '@/components/MDXRender'
import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AnimateLoader } from '@/components/ui/animate-loader'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewIcon } from '@hugeicons/core-free-icons'
import { useArticleTTS } from '@/hooks/useArticleTTS'
import { chunkContent, type ContentChunk } from '@/lib/content-chunker'
import { getFromStorage, saveToStorage } from '@/lib/storage'
import { reconstructUrl } from '@/lib/utils'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type ArticleMetadata = ArticleData['metadata']

function toChunks(parts: string[]): ContentChunk[] {
  return parts.map((text, index) => ({ text, index }))
}

function joinChunks(chunks: ContentChunk[]): string {
  return chunks.map(chunk => chunk.text).filter(Boolean).join('\n\n')
}

export default function ReadPage() {
  const params = useParams()
  const router = useRouter()
  const decodedUrlRef = useRef('')
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestInFlightRef = useRef(false)
  const articleGenerationRef = useRef(0)
  const translationGenerationRef = useRef(0)

  const [loading, setLoading] = useState(true)
  const [cleanupStatus, setCleanupStatus] = useState('')
  const [metadata, setMetadata] = useState<ArticleMetadata>({})
  const [rawChunks, setRawChunks] = useState<ContentChunk[]>([])
  const [formattedChunks, setFormattedChunks] = useState<ContentChunk[]>([])
  const [translatedChunks, setTranslatedChunks] = useState<ContentChunk[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isZenMode, setIsZenMode] = useState(false)

  const originalContent = joinChunks(formattedChunks)
  const translatedContent = joinChunks(translatedChunks)
  const listenText = showOriginal ? originalContent : translatedContent
  const listenDisabled = translatedChunks.length > 0 && !showOriginal
  const tts = useArticleTTS({ text: listenText, disabled: loading || formattedChunks.length === 0 })
  const displayedLanguage = showOriginal ? metadata.language ?? null : selectedLanguage
  const activeChunks = showOriginal ? formattedChunks : translatedChunks
  const translationPending = !showOriginal && !!selectedLanguage && translatedChunks.length < formattedChunks.length
  const formattingPending = formattedChunks.length < rawChunks.length
  const hasMore = translationPending || formattingPending

  const persistArticle = useCallback((
    nextRawChunks: ContentChunk[],
    nextFormattedChunks: ContentChunk[],
    nextMetadata: ArticleMetadata,
    nextTranslatedChunks: ContentChunk[],
    language: string | null
  ) => {
    saveToStorage(decodedUrlRef.current, {
      version: 2,
      article: {
        rawChunks: nextRawChunks.map(chunk => chunk.text),
        formattedChunks: nextFormattedChunks.map(chunk => chunk.text),
        title: nextMetadata.title,
        subheading: nextMetadata.subheading,
        author: nextMetadata.author,
        date: nextMetadata.publishedTime,
        image: nextMetadata.ogImage,
        sourceLanguage: nextMetadata.language
      },
      ...(language && nextTranslatedChunks.length > 0
        ? {
            translation: {
              chunks: nextTranslatedChunks.map(chunk => chunk.text),
              language
            }
          }
        : {}),
      timestamp: Date.now()
    })
  }, [])

  useEffect(() => {
    const generation = ++articleGenerationRef.current
    translationGenerationRef.current += 1
    let cancelled = false

    async function loadArticle() {
      try {
        setLoading(true)
        setCleanupStatus('')
        setError(null)
        setLoadMoreError(null)
        setTranslateError(null)
        setMetadata({})
        setRawChunks([])
        setFormattedChunks([])
        setTranslatedChunks([])
        setSelectedLanguage(null)
        setShowOriginal(true)

        const resolvedParams = await params
        if (cancelled || generation !== articleGenerationRef.current) return

        const seg = resolvedParams.url
        const decodedUrl = reconstructUrl(seg as string | string[])
        if (!decodedUrl.startsWith('https://') && !decodedUrl.startsWith('http://')) {
          setError('Invalid URL. Please go back and enter a valid article URL.')
          return
        }
        decodedUrlRef.current = decodedUrl

        const cached = getFromStorage(decodedUrl)
        if (cached) {
          const cachedRawChunks = toChunks(cached.article.rawChunks)
          const cachedFormattedChunks = toChunks(cached.article.formattedChunks)
          const cachedMetadata: ArticleMetadata = {
            title: cached.article.title,
            subheading: cached.article.subheading,
            author: cached.article.author,
            publishedTime: cached.article.date,
            ogImage: cached.article.image,
            language: cached.article.sourceLanguage
          }

          setRawChunks(cachedRawChunks)
          setFormattedChunks(cachedFormattedChunks)
          setMetadata(cachedMetadata)
          if (cached.translation) {
            setTranslatedChunks(toChunks(cached.translation.chunks))
            setSelectedLanguage(cached.translation.language)
            setShowOriginal(false)
          }
          return
        }

        setCleanupStatus('extracting the content...')
        const scrapeResult = await fetchContent(decodedUrl)
        if (cancelled || generation !== articleGenerationRef.current) return

        if (!scrapeResult.success || !scrapeResult.data) {
          setError(scrapeResult.error || 'Failed to load article')
          return
        }

        const nextRawChunks = chunkContent(scrapeResult.data.markdown)
        setCleanupStatus('formatting it nicely...')
        const cleanResult = await cleanMarkdown(
          nextRawChunks[0].text,
          scrapeResult.data.metadata,
          { index: 0, total: nextRawChunks.length }
        )
        if (cancelled || generation !== articleGenerationRef.current) return

        if (!cleanResult.success || !cleanResult.data) {
          setError(cleanResult.error || 'Failed to format article')
          return
        }

        const nextMetadata = {
          ...scrapeResult.data.metadata,
          ...cleanResult.data.metadata
        }
        const nextFormattedChunks = [{ text: cleanResult.data.markdown, index: 0 }]
        setRawChunks(nextRawChunks)
        setFormattedChunks(nextFormattedChunks)
        setMetadata(nextMetadata)
        persistArticle(nextRawChunks, nextFormattedChunks, nextMetadata, [], null)
      } catch {
        if (!cancelled) setError('An unexpected error occurred')
      } finally {
        if (!cancelled && generation === articleGenerationRef.current) {
          setLoading(false)
          setCleanupStatus('')
        }
      }
    }

    loadArticle()
    return () => {
      cancelled = true
    }
  }, [params, persistArticle])

  const loadNextChunk = useCallback(async (ignoreError = false) => {
    if (requestInFlightRef.current || loading || translating || (!ignoreError && loadMoreError)) return
    requestInFlightRef.current = true
    setLoadingMore(true)
    setTranslateError(null)
    const generation = articleGenerationRef.current
    const translationGeneration = translationGenerationRef.current

    try {
      if (translationPending && selectedLanguage) {
        const index = translatedChunks.length
        const sourceChunk = formattedChunks[index]
        if (!sourceChunk) return
        const result = await translateMarkdownChunk(
          sourceChunk.text,
          metadata.language || null,
          selectedLanguage,
        )
        if (
          generation !== articleGenerationRef.current ||
          translationGeneration !== translationGenerationRef.current
        ) return
        if (!result.success || result.data === undefined) {
          setTranslateError(result.error || 'Translation failed')
          return
        }
        const nextTranslatedChunks = [...translatedChunks, { text: result.data, index }]
        setTranslatedChunks(nextTranslatedChunks)
        persistArticle(rawChunks, formattedChunks, metadata, nextTranslatedChunks, selectedLanguage)
        return
      }

      const index = formattedChunks.length
      const rawChunk = rawChunks[index]
      if (!rawChunk) return

      const cleanResult = await cleanMarkdown(rawChunk.text, metadata, {
        index,
        total: rawChunks.length
      })
      if (generation !== articleGenerationRef.current) return
      if (!cleanResult.success || !cleanResult.data) {
        setLoadMoreError(cleanResult.error || 'Failed to format the next section')
        return
      }

      const nextFormattedChunks = [
        ...formattedChunks,
        { text: cleanResult.data.markdown, index }
      ]
      setFormattedChunks(nextFormattedChunks)
      persistArticle(rawChunks, nextFormattedChunks, metadata, translatedChunks, selectedLanguage)

      if (!showOriginal && selectedLanguage) {
        const result = await translateMarkdownChunk(
          cleanResult.data.markdown,
          metadata.language || null,
          selectedLanguage
        )
        if (
          generation !== articleGenerationRef.current ||
          translationGeneration !== translationGenerationRef.current
        ) return
        if (!result.success || result.data === undefined) {
          setTranslateError(result.error || 'Translation failed')
          return
        }

        const nextTranslatedChunks = [
          ...translatedChunks,
          { text: result.data, index }
        ]
        setTranslatedChunks(nextTranslatedChunks)
        persistArticle(rawChunks, nextFormattedChunks, metadata, nextTranslatedChunks, selectedLanguage)
      }
    } finally {
      requestInFlightRef.current = false
      if (generation === articleGenerationRef.current) setLoadingMore(false)
    }
  }, [
    formattedChunks,
    loadMoreError,
    loading,
    metadata,
    persistArticle,
    rawChunks,
    selectedLanguage,
    showOriginal,
    translating,
    translatedChunks,
    translationPending
  ])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || loadingMore || translating || loadMoreError || translateError) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) void loadNextChunk()
      },
      { rootMargin: '0px 0px 800px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadNextChunk, loadingMore, loadMoreError, translateError, translating])

  async function handleLanguageChange(language: string | null) {
    const translationGeneration = ++translationGenerationRef.current
    setTranslateError(null)

    if (language === null) {
      setShowOriginal(true)
      setTranslating(false)
      return
    }

    setSelectedLanguage(language)
    setShowOriginal(false)
    setTranslating(true)
    setTranslatedChunks([])

    const nextTranslatedChunks: ContentChunk[] = []
    for (let index = 0; index < formattedChunks.length; index++) {
      const result = await translateMarkdownChunk(
        formattedChunks[index].text,
        metadata.language || null,
        language
      )
      if (translationGeneration !== translationGenerationRef.current) return
      if (!result.success || result.data === undefined) {
        setTranslateError(result.error || 'Translation failed')
        setTranslating(false)
        return
      }

      nextTranslatedChunks.push({ text: result.data, index })
      setTranslatedChunks([...nextTranslatedChunks])
      persistArticle(rawChunks, formattedChunks, metadata, nextTranslatedChunks, language)
    }

    if (translationGeneration === translationGenerationRef.current) setTranslating(false)
  }

  function handleViewToggle() {
    setShowOriginal(value => !value)
    setTranslateError(null)
  }

  function handleRetryMore() {
    setLoadMoreError(null)
    setTranslateError(null)
    void loadNextChunk(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity text-primary">shift.</Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <AnimateLoader />
            <p className="text-muted-foreground">{cleanupStatus || 'loading the blog...'}</p>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity text-primary">shift.</Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <p className="text-destructive text-lg">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => router.push('/')} variant="outline">home</Button>
              <Button onClick={() => window.location.reload()}>retry</Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className={isZenMode
        ? 'fixed inset-x-0 top-0 z-10 pointer-events-none px-4 py-3'
        : 'sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3'
      }>
        <div className="max-w-4xl mx-auto flex items-center justify-end gap-4">
          {!isZenMode && (
            <>
              <Link href="/" className="mr-auto font-bold text-xl hover:opacity-80 transition-opacity text-primary">shift.</Link>
              {translatedChunks.length > 0 && (
                <Button variant="link" size="sm" onClick={handleViewToggle}>
                  {showOriginal ? 'recent translation' : 'show original'}
                </Button>
              )}
              {translating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  <span>translating...</span>
                </div>
              ) : (
                <LanguageSelector
                  sourceLanguage={metadata.language}
                  selectedLanguage={displayedLanguage}
                  onLanguageChange={handleLanguageChange}
                  disabled={loading}
                />
              )}
              <ThemeToggle />
            </>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={isZenMode ? 'pointer-events-auto bg-primary/15 text-primary hover:bg-primary/20' : undefined}
                  onClick={() => setIsZenMode(value => !value)}
                  aria-label={`${isZenMode ? 'Disable' : 'Enable'} zen mode`}
                  aria-pressed={isZenMode}
                />
              }
            >
              <HugeiconsIcon
                icon={ViewIcon}
                strokeWidth={2}
                className={isZenMode ? 'size-5 [&_path:last-child]:fill-current' : 'size-5'}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isZenMode ? 'disable' : 'enable'} zen mode
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <ArticleHeader
          title={metadata.title}
          subheading={metadata.subheading}
          author={metadata.author}
          date={metadata.publishedTime}
          image={metadata.ogImage}
        />

        {!isZenMode && (
          <ListenToArticle
            state={tts.state}
            audioRef={tts.audioRef}
            chunks={tts.chunks}
            tooLong={tts.tooLong}
            empty={tts.empty}
            words={tts.words}
            chars={tts.chars}
            readingMinutes={tts.readingMinutes}
            volume={tts.volume}
            disabled={listenDisabled}
            disabledMessage={listenDisabled ? 'listen to blog is only available for english' : undefined}
            onToggle={tts.onToggle}
            onVolumeChange={tts.onVolumeChange}
            onMuteToggle={tts.onMuteToggle}
          />
        )}

        <div className="prose prose-sm dark:prose-invert max-w-none cursor-text">
          {activeChunks.map(chunk => (
            <MDXRender key={chunk.index} content={chunk.text} />
          ))}
        </div>

        <div ref={sentinelRef} className="min-h-20 flex items-center justify-center py-6">
          {(loadingMore || translating) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              <span>loading more content...</span>
            </div>
          )}
          {(loadMoreError || translateError) && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-destructive">{loadMoreError || translateError}</p>
              <Button variant="outline" size="sm" onClick={handleRetryMore}>retry</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
