'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

export default function Home() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    if (!url.startsWith('https://')) {
      setError('Please enter a valid HTTPS URL')
      return
    }

    setError('')
    const encoded = encodeURIComponent(url)
    router.push(`/read/${encoded}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="absolute top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-8 text-center">
          <h1 className="text-6xl font-bold tracking-tight">Shift</h1>
          <p className="text-xl text-muted-foreground">
            Read any article in your language
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError('')
                }}
                placeholder="https://example.com/article"
                className="w-full h-14 px-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              {error && (
                <p className="text-sm text-destructive text-left">{error}</p>
              )}
            </div>
            
            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-base"
            >
              Extract & Read
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
