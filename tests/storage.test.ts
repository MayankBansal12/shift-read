import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFromStorage,
  getStorageKey,
  saveToStorage,
  type StoredArticle
} from '../lib/storage'

const URL = 'https://example.com/article'

function createStoredArticle(): StoredArticle {
  return {
    version: 2,
    article: {
      rawChunks: ['raw one', 'raw two'],
      formattedChunks: ['formatted one']
    },
    timestamp: Date.now()
  }
}

describe('article storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists partially formatted articles', () => {
    const article = createStoredArticle()

    saveToStorage(URL, article)

    expect(getFromStorage(URL)).toEqual(article)
  })

  it('persists progressive translations', () => {
    const article: StoredArticle = {
      ...createStoredArticle(),
      translation: {
        language: 'es',
        chunks: ['traducido uno']
      }
    }

    saveToStorage(URL, article)

    expect(getFromStorage(URL)?.translation).toEqual(article.translation)
  })

  it('invalidates unversioned cache entries', () => {
    localStorage.setItem(getStorageKey(URL), JSON.stringify({
      article: { content: 'legacy content' },
      timestamp: Date.now()
    }))

    expect(getFromStorage(URL)).toBeNull()
    expect(localStorage.getItem(getStorageKey(URL))).toBeNull()
  })

  it('removes expired partial articles', () => {
    const article = createStoredArticle()
    article.timestamp = Date.now() - 25 * 60 * 60 * 1000
    saveToStorage(URL, article)

    expect(getFromStorage(URL)).toBeNull()
  })
})
