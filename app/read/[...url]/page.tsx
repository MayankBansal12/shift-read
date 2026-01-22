'use client'

import { cleanMarkdown } from '@/app/actions/cleanMarkdown'
import { fetchContent, type ArticleData } from '@/app/actions/fetchContent'
import ArticleHeader from '@/components/ArticleHeader'
import { MDXRender } from '@/components/MDXRender'
import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { reconstructUrl } from '@/lib/utils'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ReadPage() {
  const params = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [cleanupStatus, setCleanupStatus] = useState('')
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    
    async function loadArticle() {
      try {
        if (cancelled) return
        
        const resolvedParams = await params
        const decodedUrl = reconstructUrl(resolvedParams.url as string | string[])

        setLoading(true)
        setCleanupStatus('')
        setError(null)
        
        setCleanupStatus('Fetching article...')
        const scrapeResult = await fetchContent(decodedUrl)
        
        if (!scrapeResult.success || !scrapeResult.data) {
          setError(scrapeResult.error || 'Failed to load article')
          return
        }

        setCleanupStatus('Cleaning up content...')
        const cleanResult = await cleanMarkdown(
          scrapeResult.data.markdown,
          scrapeResult.data.metadata
        )

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
      } catch (err) {
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
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
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
            <div className="text-sm text-muted-foreground">
              Language selector (coming soon)
            </div>
            <div className="text-sm text-muted-foreground">
              Show Original (coming soon)
            </div>
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
        
        <div className="prose prose-sm dark:prose-invert max-w-none cursor-text transition-all">
          <MDXRender content={article.markdown} />
        </div>
      </main>
    </div>
  )
}
