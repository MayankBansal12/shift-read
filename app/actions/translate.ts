'use server'

import { JigsawStack } from 'jigsawstack'
import { chunkContent, CONTENT_CHUNK_SIZE } from '@/lib/content-chunker'

export async function translateMarkdown(
  markdown: string,
  sourceLanguage: string | null,
  targetLanguage: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const jigsaw = JigsawStack({
      apiKey: process.env.JIGSAW_STACK_KEY || ''
    })

    const translateText = async (text: string): Promise<string> => {
      console.log('[translateMarkdown] Translating chunk from', sourceLanguage || 'auto', 'to', targetLanguage, '| chars:', text.length)
      const result = await jigsaw.translate.text({
        text,
        target_language: targetLanguage,
        ...(sourceLanguage ? { current_language: sourceLanguage } : {})
      } as Parameters<typeof jigsaw.translate.text>[0])

      if (!result.success) {
        throw new Error('Translation failed')
      }

      return result.translated_text as string
    }

    if (markdown.length <= CONTENT_CHUNK_SIZE) {
      const translated = await translateText(markdown)
      console.log('[translateMarkdown] Single-chunk translation succeeded, length:', translated.length)
      return { success: true, data: translated }
    }

    console.log('[translateMarkdown] Content too large, chunking. Total chars:', markdown.length)
    const chunks = chunkContent(markdown, CONTENT_CHUNK_SIZE)
    console.log('[translateMarkdown] Split into', chunks.length, 'chunks')

    const translatedParts: string[] = []
    for (let i = 0; i < chunks.length; i++) {
      console.log('[translateMarkdown] Translating chunk', i + 1, 'of', chunks.length)
      const translated = await translateText(chunks[i].text)
      translatedParts.push(translated)
    }

    const finalText = translatedParts.join('\n\n')
    console.log('[translateMarkdown] Multi-chunk translation succeeded, total length:', finalText.length)
    return { success: true, data: finalText }
  } catch (error) {
    console.error('Translation error:', error)
    return {
      success: false,
      error: 'Failed to translate content'
    }
  }
}

export async function translateMarkdownChunk(
  markdown: string,
  sourceLanguage: string | null,
  targetLanguage: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  return translateMarkdown(markdown, sourceLanguage, targetLanguage)
}
