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
import { getFromPdfSession, getFromStorage, isPdfToken, pdfIdFromToken, savePdfToSession, saveToStorage } from '@/lib/storage'
import { useArticleTTS } from '@/hooks/useArticleTTS'
import { reconstructUrl } from '@/lib/utils'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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
  const [pdfId, setPdfId] = useState<string | null>(null)
  const [pdfImages, setPdfImages] = useState<string[]>([])

  const listenText = showOriginal
    ? (article?.markdown ?? '')
    : (translatedContent ?? article?.markdown ?? '')

  const tts = useArticleTTS({ text: listenText, disabled: loading || !article })

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
        setSelectedLanguage(null)
        setShowOriginal(true)

        if (isPdfToken(token)) {
          const id = pdfIdFromToken(token)
          setPdfId(id)
          const sessionArticle = getFromPdfSession(id)
          if (!sessionArticle) {
            setError('This PDF is no longer available. Please re-upload from home.')
            return
          }
          setArticle({
            markdown: sessionArticle.article.content,
            metadata: {
              title: sessionArticle.article.title,
              author: sessionArticle.article.author,
              publishedTime: sessionArticle.article.date
            }
          })
          setPdfImages(sessionArticle.article.images ?? [])
          if (sessionArticle.translation) {
            setTranslatedContent(sessionArticle.translation.content)
            setSelectedLanguage(sessionArticle.translation.language)
            setShowOriginal(false)
          }
          setLoading(false)
          return
        }
        setPdfId(null)
        setPdfImages([])

        const decodedUrl = reconstructUrl(seg as string | string[])
        if (!decodedUrl.startsWith('https://') && !decodedUrl.startsWith('http://')) {
          setError('Invalid URL. Please go back and enter a valid article URL.')
          return
        }
        decodedUrlRef.current = decodedUrl

        const cached = getFromStorage(decodedUrl)
        if (cached) {
          setArticle({
            markdown: cached.article.content,
            metadata: {
              title: cached.article.title,
              author: cached.article.author,
              publishedTime: cached.article.date,
              ogImage: cached.article.image,
              language: cached.article.sourceLanguage
            }
          })
          if (cached.translation) {
            setTranslatedContent(cached.translation.content)
            setSelectedLanguage(cached.translation.language)
            setShowOriginal(false)
          }
          setLoading(false)
          return
        }

        setCleanupStatus('Fetching article...')
        const scrapeResult = await fetchContent(decodedUrl)

        if (cancelled) return

        if (!scrapeResult.success || !scrapeResult.data) {
          setError(scrapeResult.error || 'Failed to load article')
          return
        }

        setCleanupStatus('Cleaning up content...')
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
        saveToStorage(decodedUrl, {
          article: {
            content: finalArticle.markdown,
            title: finalArticle.metadata.title,
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
      setShowOriginal(false)
      setSelectedLanguage(language)

      const articleRecord = {
        article: {
          content: article.markdown,
          title: article.metadata.title,
          author: article.metadata.author,
          date: article.metadata.publishedTime,
          images: pdfImages,
          sourceLanguage: article.metadata.language
        },
        translation: { content: result.data, language },
        timestamp: Date.now()
      }

      if (pdfId) {
        savePdfToSession(pdfId, articleRecord)
      } else {
        saveToStorage(decodedUrlRef.current, {
          ...articleRecord,
          article: { ...articleRecord.article, image: article.metadata.ogImage }
        })
      }
    } else {
      setTranslateError(result.error || 'Translation failed')
      setShowOriginal(true)
    }

    setTranslating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity">
              Shift
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">{cleanupStatus || 'Loading article...'}</p>
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
            <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity">
              Shift
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <p className="text-destructive text-lg">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => router.push('/')} variant="outline">
                Go Home
              </Button>
              <Button onClick={() => window.location.reload()}>Retry</Button>
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
          <Link href="/" className="font-bold text-xl hover:opacity-80 transition-opacity">
            Shift
          </Link>
          <div className="flex items-center gap-4">
            {translating ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Translating...</span>
              </div>
            ) : (
              <LanguageSelector
                sourceLanguage={article.metadata.language}
                selectedLanguage={selectedLanguage}
                onLanguageChange={handleLanguageChange}
                disabled={loading}
              />
            )}

            {translatedContent && (
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
              >
                {showOriginal ? 'Recent Translation' : 'Show Original'}
              </button>
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
          onToggle={tts.onToggle}
          onVolumeChange={tts.onVolumeChange}
          onMuteToggle={tts.onMuteToggle}
        />

        <div className="prose prose-sm dark:prose-invert max-w-none cursor-text transition-all">
          <MDXRender content={(pdfImages.length
            ? (showOriginal ? article.markdown : translatedContent || '').replace(/\[img:(\d+)\]/g, (_, i) => {
                const url = pdfImages[Number(i)]
                return url ? `![image](${url})` : ''
              })
            : showOriginal ? article.markdown : translatedContent || ''
          )} />
        </div>
      </main>
    </div>
  )
}
