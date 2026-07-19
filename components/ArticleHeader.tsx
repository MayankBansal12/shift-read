import Image from 'next/image'

interface ArticleHeaderProps {
  title?: string
  subheading?: string
  author?: string
  date?: string
  image?: string
}

export default function ArticleHeader({
  title,
  subheading,
  author,
  date,
  image,
}: ArticleHeaderProps) {
  return (
    <header className="mb-8 pb-8 border-b border-border">
      {image && (
        <div className="relative w-full h-64 sm:h-96 mb-6 rounded-xl overflow-hidden">
          <Image
            src={image}
            alt={title || 'blog'}
            fill
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      )}
      {title && (
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">{title}</h1>
      )}
      {subheading && (
        <p className="text-lg text-muted-foreground my-2">{subheading}</p>
      )}
      {(author || date) && (
        <div className="flex items-center gap-4 text-muted-foreground text-sm">
          {author && <span>By {author}</span>}
          {author && date && <span>•</span>}
          {date && (
            <span>
              {new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      )}
    </header>
  )
}
