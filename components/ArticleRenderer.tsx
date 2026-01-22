'use client'

import React, { useState, ComponentPropsWithoutRef } from 'react'
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

function ImageComponent({ src, alt }: { src: string | null; alt?: string }) {
  const [hasError, setHasError] = useState(false)

  if (hasError || !src) {
    return null
  }

  return (
    <figure className="my-8 rounded-lg overflow-hidden bg-muted">
      <Image
        src={src}
        alt={alt || ''}
        width={0}
        height={0}
        sizes="100vw"
        className="w-full h-auto"
        unoptimized
        onError={() => setHasError(true)}
      />
      {alt && (
        <figcaption className="text-sm text-muted-foreground mt-3 text-center italic px-4">
          {alt}
        </figcaption>
      )}
    </figure>
  )
}

function LinkComponent({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>

  const isExternal = href.startsWith('http://') || href.startsWith('https://')

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-primary hover:underline decoration-primary/30 underline-offset-2"
    >
      {children}
    </a>
  )
}

function CodeComponent({ inline, className, children, ...props }: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
  const match = /language-(\w+)/.exec(className || '')
  const codeString = String(children).replace(/\n$/, '')

  if (!inline && match && className) {
    return (
      <SyntaxHighlighter
        language={match[1]}
        style={vscDarkPlus}
        PreTag="div"
        className="rounded-lg my-4 text-sm"
      >
        {codeString}
      </SyntaxHighlighter>
    )
  }

  return (
    <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
      {children}
    </code>
  )
}

export default function ArticleRenderer({ content }: ArticleRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        img: ({ src }) => <ImageComponent src={src as string | null} />,
        a: ({ href, children }) => <LinkComponent href={href}>{children}</LinkComponent>,
        code: CodeComponent
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
