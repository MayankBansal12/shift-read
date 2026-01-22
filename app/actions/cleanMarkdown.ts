'use server'

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY
})

const CleanupResponseSchema = z.object({
  content: z.string().describe('Cleaned and formatted markdown content'),
  warnings: z.array(z.string()).optional().describe('Any warnings or notes about the cleanup'),
  isComplete: z.boolean().describe('Whether the cleanup was successful and content is readable')
})

export interface CleanedArticle {
  markdown: string
  metadata: {
    title?: string
    author?: string
    publishedTime?: string
    ogImage?: string
    language?: string
  }
}

const CLEANUP_SYSTEM_PROMPT = `You are a markdown cleaning and formatting expert for scraped web content.

The content you receive is extracted from a webpage and will contain:
- Unnecessary ads, banners, and promotional content
- Navigation elements, footers, and sidebars
- Interruptions from embedded content (social media posts, newsletters)
- Broken or malformed markdown from the extraction process
- HTML entities and encoding issues
- Inconsistent formatting and structure

Your task is to extract ONLY the main article content and return it as clean, well-formatted markdown.

Rules:
1. Remove ALL ads, promotional content, and navigation elements
2. Remove social media embeds, newsletter signups, and related content
3. Remove the article's featured image if present (it will be handled separately)
4. Fix broken or malformed markdown syntax
5. Fix encoding issues (HTML entities, weird characters)
6. Preserve all meaningful article content and structure
7. Ensure proper heading hierarchy (H1 → H2 → H3, no skips)
8. Fix code blocks with proper language annotations
9. Preserve links and fix broken ones
10. Keep tables, blockquotes, lists properly formatted
11. Remove excessive newlines or add necessary ones for readability
12. If content appears to be mostly boilerplate/navigation with no main article, set isComplete to false
13. Return the final cleaned content ready for reading

IMPORTANT: You must return your response as a valid JSON object with the following structure:
{
  "content": "The cleaned markdown content here",
  "warnings": ["Any warnings or notes about what was removed"],
  "isComplete": true/false
}

Do not include any additional text or markdown code blocks - just the raw JSON object.`

export async function cleanMarkdown(
  rawMarkdown: string,
  metadata?: Record<string, string | undefined>
): Promise<{ success: boolean; data?: CleanedArticle; error?: string }> {
  try {
    const { text } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [
        {
          role: 'system',
          content: CLEANUP_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Clean the following scraped content. Return only the main article body, excluding any title, featured image, ads, navigation, or related content.\n\n=== CONTENT START ===\n${rawMarkdown}\n=== CONTENT END ===`
        }
      ],
      temperature: 0.2,
      maxOutputTokens: 32768
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Failed to parse cleanup response'
      }
    }

    const cleaned = CleanupResponseSchema.parse(JSON.parse(jsonMatch[0]))

    if (!cleaned.isComplete || !cleaned.content.trim()) {
      return {
        success: false,
        error: 'Could not extract meaningful content from the article'
      }
    }

    return {
      success: true,
      data: {
        markdown: cleaned.content,
        metadata: {
          title: metadata?.title,
          author: metadata?.author,
          publishedTime: metadata?.publishedTime,
          ogImage: metadata?.ogImage,
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
