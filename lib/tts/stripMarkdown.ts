export class ArticleTooLongError extends Error {
  constructor(public readonly length: number) {
    super(`Article is too long to listen to in one session (${length} chars)`)
    this.name = 'ArticleTooLongError'
  }
}

export function stripMarkdown(input: string): string {
  let text = input

  text = text.replace(/```[\s\S]*?```/g, '')
  text = text.replace(/`[^`\n]*`/g, '')

  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '')

  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  text = text.replace(/<https?:\/\/[^>]+>/gi, '')

  text = text.replace(/^#{1,6}\s+/gm, '')

  text = text.replace(/^>\s+/gm, '')

  text = text.replace(/^\s*\|.*\|\s*$/gm, (line) => line.replace(/\|/g, ' '))
  text = text.replace(/^\s*[-:|\s]+$/gm, ' ')

  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}
