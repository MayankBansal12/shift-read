export interface StoredArticle {
  version: 2
  article: {
    rawChunks: string[]
    formattedChunks: string[]
    title?: string
    subheading?: string
    author?: string
    date?: string
    image?: string
    sourceLanguage?: string
  }
  translation?: {
    chunks: string[]
    language: string
  }
  timestamp: number
}

const CACHE_EXPIRATION = 24 * 60 * 60 * 1000

export function getStorageKey(url: string): string {
  return `shift_article_${encodeURIComponent(url)}`
}

export function getFromStorage(url: string): StoredArticle | null {
  if (typeof window === 'undefined') return null
  
  try {
    const key = getStorageKey(url)
    const item = localStorage.getItem(key)
    if (!item) return null
    
    const data = JSON.parse(item) as Partial<StoredArticle>

    if (
      data.version !== 2 ||
      !data.article ||
      !Array.isArray(data.article.rawChunks) ||
      !Array.isArray(data.article.formattedChunks) ||
      typeof data.timestamp !== 'number'
    ) {
      localStorage.removeItem(key)
      return null
    }
    
    if (Date.now() - data.timestamp > CACHE_EXPIRATION) {
      localStorage.removeItem(key)
      return null
    }
    
    return data as StoredArticle
  } catch (error) {
    console.error('[storage] JSON parse error on getFromStorage:', {
      url,
      storageKey: getStorageKey(url),
      error: error instanceof Error ? error.message : String(error),
      rawValue: typeof window !== 'undefined' ? localStorage.getItem(getStorageKey(url))?.substring(0, 500) : 'N/A'
    })
    return null
  }
}

export function saveToStorage(url: string, data: StoredArticle): void {
  if (typeof window === 'undefined') return
  
  try {
    const key = getStorageKey(url)
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('[storage] JSON stringify/save error on saveToStorage:', {
      url,
      storageKey: getStorageKey(url),
      error: error instanceof Error ? error.message : String(error),
      dataKeys: Object.keys(data)
    })
  }
}

export function clearFromStorage(url: string): void {
  if (typeof window === 'undefined') return

  try {
    const key = getStorageKey(url)
    localStorage.removeItem(key)
  } catch {
  }
}
