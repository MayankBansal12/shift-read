'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'
import ArticleHeader from '@/components/ArticleHeader'
import ArticleRenderer from '@/components/ArticleRenderer'
import { fetchContent, type ArticleData } from '@/app/actions/fetchContent'

export default function ReadPage() {
  const params = useParams()
  const router = useRouter()
  const decodedUrl = decodeURIComponent(params.url as string)
  
  const [loading, setLoading] = useState(true)
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadArticle() {
      try {
        setLoading(true)
        setError(null)
        
        const result = await fetchContent(decodedUrl)
        
        if (!result.success || !result.data) {
          setError(result.error || 'Failed to load article')
          return
        }

        setArticle(result.data)
      } catch (err) {
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    loadArticle()
  }, [decodedUrl])

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
            <p className="text-muted-foreground">Loading article...</p>
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
        
        <article className="prose prose-lg dark:prose-invert max-w-none">
          <ArticleRenderer content={article.markdown} />
        </article>
      </main>
    </div>
  )
}
