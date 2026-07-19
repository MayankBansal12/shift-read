'use server'

import { JigsawStack } from 'jigsawstack'

export async function translateMarkdown(
  markdown: string,
  sourceLanguage: string | null,
  targetLanguage: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const jigsaw = JigsawStack({
      apiKey: process.env.JIGSAW_STACK_KEY || ''
    })

    console.log('[translateMarkdown] Translating from', sourceLanguage || 'auto', 'to', targetLanguage, '| chars:', markdown.length)
    const result = await jigsaw.translate.text({
      text: markdown,
      target_language: targetLanguage,
      ...(sourceLanguage ? { current_language: sourceLanguage } : {})
    } as Parameters<typeof jigsaw.translate.text>[0])

    if (!result.success) {
      console.warn('[translateMarkdown] Translation failed, result:', JSON.stringify(result))
      return {
        success: false,
        error: 'Failed to translate content'
      }
    }

    console.log('[translateMarkdown] Translation succeeded, translated text length:', (result.translated_text as string)?.length, 'chars')
    return {
      success: true,
      data: result.translated_text as string
    }
  } catch (error) {
    console.error('Translation error:', error)
    return {
      success: false,
      error: 'Failed to translate content'
    }
  }
}
