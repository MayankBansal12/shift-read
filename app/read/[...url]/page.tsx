'use client'

import { cleanMarkdown } from '@/app/actions/cleanMarkdown'
import { fetchContent, type ArticleData } from '@/app/actions/fetchContent'
import { translateMarkdown } from '@/app/actions/translate'
import ArticleHeader from '@/components/ArticleHeader'
import LanguageSelector from '@/components/LanguageSelector'
import ListenToArticle from '@/components/ListenToArticle'
import { MDXRender } from '@/components/MDXRender'
import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { getFromStorage, saveToStorage } from '@/lib/storage'
import { useArticleTTS } from '@/hooks/useArticleTTS'
import { reconstructUrl } from '@/lib/utils'
import { chunkContent, type ContentChunk } from '@/lib/content-chunker'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { AnimateLoader } from '@/components/ui/animate-loader'

export default function ReadPage() {
  const params = useParams()
  const router = useRouter()
  const decodedUrlRef = useRef<string>('')

  const [loading, setLoading] = useState(true)
  const [cleanupStatus, setCleanupStatus] = useState('')
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [translatedContent, setTranslatedContent] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(true)
  const [contentChunks, setContentChunks] = useState<ContentChunk[]>([])
  const [translatedChunks, setTranslatedChunks] = useState<ContentChunk[]>([])
  const [visibleChunkCount, setVisibleChunkCount] = useState(1)

  const listenText = showOriginal
    ? (article?.markdown ?? '')
    : (translatedContent ?? article?.markdown ?? '')

  const listenDisabled = !!(translatedContent && !showOriginal)

  const tts = useArticleTTS({ text: listenText, disabled: loading || !article })

  const displayedLanguage = showOriginal
    ? (article?.metadata.language ?? null)
    : selectedLanguage

  useEffect(() => {
    let cancelled = false

    async function loadArticle() {
      try {
        const resolvedParams = await params
        if (cancelled) return

        const seg = resolvedParams.url
        const rawToken = Array.isArray(seg) ? seg[0] : seg
        let token: string
        try {
          token = decodeURIComponent(rawToken as string)
        } catch {
          token = rawToken as string
        }

        setLoading(true)
        setCleanupStatus('')
        setError(null)
        setTranslatedContent(null)
        setTranslatedChunks([])
        setSelectedLanguage(null)
        setShowOriginal(true)
        setVisibleChunkCount(1)

        const decodedUrl = reconstructUrl(seg as string | string[])
        if (!decodedUrl.startsWith('https://') && !decodedUrl.startsWith('http://')) {
          setError('Invalid URL. Please go back and enter a valid article URL.')
          return
        }
        decodedUrlRef.current = decodedUrl

        const cached = getFromStorage(decodedUrl)
        if (cached) {
          console.log('[ReadPage] Loaded article from cache for:', decodedUrl)
          setArticle({
            markdown: cached.article.content,
            metadata: {
              title: cached.article.title,
              subheading: cached.article.subheading,
              author: cached.article.author,
              publishedTime: cached.article.date,
              ogImage: cached.article.image,
              language: cached.article.sourceLanguage
            }
          })
          setContentChunks(chunkContent(cached.article.content))
          if (cached.translation) {
            setTranslatedContent(cached.translation.content)
            setTranslatedChunks(chunkContent(cached.translation.content))
            setSelectedLanguage(cached.translation.language)
            setShowOriginal(false)
          }
          setLoading(false)
          return
        }

        setCleanupStatus('Extracting the content...')
        const scrapeResult = await fetchContent(decodedUrl)

        if (cancelled) return

        if (!scrapeResult.success || !scrapeResult.data) {
          setError(scrapeResult.error || 'Failed to load article')
          return
        }

        setCleanupStatus('formatting it nicely...')
        const cleanResult = await cleanMarkdown(
          scrapeResult.data.markdown,
          scrapeResult.data.metadata
        )

        if (cancelled) return

        let finalArticle: ArticleData

        if (cleanResult.success && cleanResult.data) {
          finalArticle = {
            markdown: cleanResult.data.markdown,
            metadata: cleanResult.data.metadata
          }
        } else {
          console.warn('Markdown cleanup failed, using raw content:', cleanResult.error)
          finalArticle = scrapeResult.data
        }

        setArticle(finalArticle)
        setContentChunks(chunkContent(finalArticle.markdown))
        saveToStorage(decodedUrl, {
          article: {
            content: finalArticle.markdown,
            title: finalArticle.metadata.title,
            subheading: finalArticle.metadata.subheading,
            author: finalArticle.metadata.author,
            date: finalArticle.metadata.publishedTime,
            image: finalArticle.metadata.ogImage,
            sourceLanguage: finalArticle.metadata.language
          },
          timestamp: Date.now()
        })
      } catch (_err) {
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
        setCleanupStatus('')
      }
    }

    loadArticle()

    return () => {
      cancelled = true
    }
  }, [params])

  async function handleLanguageChange(language: string | null) {
    if (!article) return

    setTranslateError(null)

    if (language === null) {
      setShowOriginal(true)
      setSelectedLanguage(null)
      return
    }

    setTranslating(true)
    const result = await translateMarkdown(
      article.markdown,
      article.metadata.language || null,
      language
    )

    if (result.success && result.data) {
      setTranslatedContent(result.data)
      setTranslatedChunks(chunkContent(result.data))
      setShowOriginal(false)
      setSelectedLanguage(language)

      saveToStorage(decodedUrlRef.current, {
        article: {
          content: article.markdown,
          title: article.metadata.title,
          subheading: article.metadata.subheading,
          author: article.metadata.author,
          date: article.metadata.publishedTime,
          image: article.metadata.ogImage,
          sourceLanguage: article.metadata.language
        },
        translation: { content: result.data, language },
        timestamp: Date.now()
      })
    } else {
      setTranslateError(result.error || 'Translation failed')
      setShowOriginal(true)
    }

    setTranslating(false)
  }

  const activeChunks = showOriginal ? contentChunks : translatedChunks
  const clampedCount = Math.min(visibleChunkCount, activeChunks.length)
  const displayContent = activeChunks.slice(0, clampedCount).map(c => c.text).join('\n\n')
  const hasMore = clampedCount < activeChunks.length
  const remainingChars = activeChunks.slice(clampedCount).reduce((sum, c) => sum + c.text.length, 0)

  function handleReadMore() {
    setVisibleChunkCount(prev => prev + 1)
  }

  function handleViewToggle() {
    const nextShowOriginal = !showOriginal
    setShowOriginal(nextShowOriginal)
    const targetChunks = nextShowOriginal ? contentChunks : translatedChunks
    setVisibleChunkCount(prev => Math.min(prev, targetChunks.length))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity text-primary">
              shift.
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <AnimateLoader />
            <p className="text-muted-foreground">{cleanupStatus?.toLowerCase() || 'loading the blog...'}</p>
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
            <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity text-primary">
              shift.
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <p className="text-destructive text-lg">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => router.push('/')} variant="outline">
                home
              </Button>
              <Button onClick={() => window.location.reload()}>retry</Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!article) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity text-primary">
            shift.
          </Link>
          <div className="flex items-center gap-4">
            {translatedContent && (
              <Button
                variant="link"
                size="sm"
                onClick={handleViewToggle}
              >
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
                sourceLanguage={article.metadata.language}
                selectedLanguage={displayedLanguage}
                onLanguageChange={handleLanguageChange}
                disabled={loading}
              />
            )}
            {translateError && (
              <span className="text-xs text-destructive">{translateError}</span>
            )}

            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        <ArticleHeader
          title={article.metadata.title}
          subheading={article.metadata.subheading}
          author={article.metadata.author}
          date={article.metadata.publishedTime}
          image={article.metadata.ogImage}
        />

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
          disabledMessage={listenDisabled ? "listen to blog is only available for english" : undefined}
          onToggle={tts.onToggle}
          onVolumeChange={tts.onVolumeChange}
          onMuteToggle={tts.onMuteToggle}
        />

        <div className="prose prose-sm dark:prose-invert max-w-none cursor-text transition-all">
          <MDXRender content={displayContent} />
        </div>

        {hasMore && (
          <div className="flex justify-center mt-8">
            <Button variant="outline" onClick={handleReadMore} size="sm">
              read more ({remainingChars.toLocaleString()} characters remaining)
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
