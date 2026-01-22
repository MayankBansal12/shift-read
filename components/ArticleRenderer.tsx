'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import Image from 'next/image'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import 'highlight.js/styles/github-dark.css'

interface ArticleRendererProps {
  content: string
}

export default function ArticleRenderer({ content }: ArticleRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        img: ({ src, alt }) => (
          <div className="my-8 rounded-lg overflow-hidden">
            {src && typeof src === 'string' && (
              <>
                <Image
                  src={src}
                  alt={alt || ''}
                  width={800}
                  height={400}
                  className="w-full h-auto object-cover"
                  unoptimized
                />
                {alt && <p className="text-sm text-muted-foreground mt-2 text-center">{alt}</p>}
              </>
            )}
          </div>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {children}
          </a>
        ),
        code: ({ node, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '')
          const codeString = String(children).replace(/\n$/, '')
          
          if (match && className) {
            return (
              <SyntaxHighlighter
                language={match[1]}
                style={vscDarkPlus}
                PreTag="div"
                className="rounded-lg my-4"
              >
                {codeString}
              </SyntaxHighlighter>
            )
          }
          
          return (
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
              {children}
            </code>
          )
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
