'use server'

import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { CLEANUP_SYSTEM_PROMPT } from '@/lib/system-prompt'

const opencode = createAnthropic({
  baseURL: process.env.OPENCODE_BASE_URL!,
  apiKey: process.env.OPENCODE_API_KEY
})

const CleanupResponseSchema = z.object({
  content: z.string().describe('Cleaned and formatted markdown content'),
  warnings: z.array(z.string()).optional().describe('Any warnings or notes about the cleanup'),
  isComplete: z.boolean().describe('Whether the cleanup was successful and content is readable'),
  metadata: z.object({
    title: z.string().nullable().optional().describe('Extracted article title'),
    subheading: z.string().nullable().optional().describe('Extracted article subheading/subtitle'),
    author: z.string().nullable().optional().describe('Extracted author name'),
    publishedTime: z.string().nullable().optional().describe('Publication date in ISO 8601 format'),
    ogImage: z.string().nullable().optional().describe('Featured image URL from markdown or fallback to firecrawl metadata')
  }).optional()
})

export interface CleanedArticle {
  markdown: string
  metadata: {
    title?: string
    subheading?: string
    author?: string
    publishedTime?: string
    ogImage?: string
    language?: string
  }
}

export async function cleanMarkdown(
  rawMarkdown: string,
  metadata?: Record<string, string | undefined>
): Promise<{ success: boolean; data?: CleanedArticle; error?: string }> {
  try {
    console.log('[cleanMarkdown] Starting cleanup, raw markdown length:', rawMarkdown.length, 'chars')
    const { text } = await generateText({
      model: opencode(`${process.env.OPENCODE_MODEL!}`),
      instructions: CLEANUP_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Clean the following scraped content. Extract metadata (title, author, date, image) and return only the main article body, excluding any title, featured image, ads, navigation, or related content.\n\n=== FIRECRAWL METADATA (FOR CONTEXT) ===\n${JSON.stringify(metadata || {}, null, 2)}\n\n=== CONTENT START ===\n${rawMarkdown}\n=== CONTENT END ===`
        }
      ],
      temperature: 0.2,
    })

    let jsonString = text.trim()
    jsonString = jsonString.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim()
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', text.substring(0, 500))
      return {
        success: false,
        error: 'Failed to parse cleanup response'
      }
    }

    let parsedJson
    try {
      parsedJson = JSON.parse(jsonMatch[0])
    }catch (parseError) {
      console.error('JSON parse error:', parseError)
      return {
        success: false,
        error: 'Failed to parse cleanup response: invalid JSON format'
      }
    }

    const cleaned = CleanupResponseSchema.parse(parsedJson)

    if (!cleaned.isComplete || !cleaned.content.trim()) {
      console.warn('[cleanMarkdown] Cleanup incomplete or empty content')
      return {
        success: false,
        error: 'Could not extract meaningful content from the article'
      }
    }

    console.log('[cleanMarkdown] Cleanup succeeded, cleaned markdown length:', cleaned.content.length, 'chars')
    return {
      success: true,
      data: {
        markdown: cleaned.content,
        metadata: {
          title: cleaned.metadata?.title || metadata?.title,
          subheading: cleaned.metadata?.subheading || metadata?.subheading,
          author: cleaned.metadata?.author || metadata?.author,
          publishedTime: cleaned.metadata?.publishedTime || metadata?.publishedTime,
          ogImage: cleaned.metadata?.ogImage || metadata?.ogImage,
          language: metadata?.language
        }
      }
    }
  } catch (error) {
    console.error('Markdown cleanup error:', error)
    return {
      success: false,
      error: 'Failed to clean markdown content'
    }
  }
}
