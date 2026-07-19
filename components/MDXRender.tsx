"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import Image from "next/image";

import { useMemo } from "react";

const YOUTUBE_DOMAINS = ["youtube.com", "youtu.be"];

function isYouTubeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
    if (YOUTUBE_DOMAINS.some((d) => parsed.hostname.includes(d))) {
      return parsed.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
}

function VideoRenderer({ src }: { src: string }) {
  const videoId = isYouTubeUrl(src);
  if (videoId) {
    return (
      <div className="relative w-full aspect-video my-4 rounded-lg overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  const isDirectVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src);
  if (isDirectVideo) {
    return (
      <video controls className="w-full my-4 rounded-lg" preload="metadata">
        <source src={src} />
      </video>
    );
  }

  return null;
}

interface MDXRenderProps {
  content: string;
  className?: string;
}

export function MDXRender({ content, className = "" }: MDXRenderProps) {
  useMemo(() => {
    console.log('[MDXRender] Rendering markdown content, length:', content.length, 'chars')
  }, [content])

  return (
    <div
      className={`mdx-content text-foreground ${className}`}
      style={{ lineHeight: "1.75" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="my-4 font-bold text-3xl first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="my-3 font-semibold text-2xl first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="my-2 font-semibold text-xl first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-4 list-outside list-disc space-y-1 pl-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-outside list-decimal space-y-1 pl-4">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                {children}
              </code>
            ) : (
              <code className={className}>{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-4">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-muted-foreground border-l-4 pl-4 italic">
              {children}
            </blockquote>
          ),
          img: ({ src, alt }) => (
            <span className="block relative w-full my-4 rounded-lg overflow-hidden">
              <Image
                src={String(src || '')}
                alt={String(alt || '')}
                width={800}
                height={450}
                className="w-full h-auto object-cover"
                unoptimized
              />
            </span>
          ),
          a: ({ children, href }) => {
            if (href && isYouTubeUrl(href)) {
              return <VideoRenderer src={href} />;
            }
            const isExternal =
              href &&
              (href.startsWith("http://") || href.startsWith("https://"));
            return (
              <a
                href={href}
                className="text-primary underline hover:text-primary/80"
                {...(isExternal
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
