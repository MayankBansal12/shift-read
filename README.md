# Shift

Read any article on the internet in your preferred language. Shift extracts article content from web pages and translates it while preserving formatting, images, and typography.

## Features

- Extracts clean article content from any URL using Firecrawl
- Translates articles to 12+ languages while preserving Markdown formatting
- Caches articles and translations locally for instant re-access
- Dark mode and light mode support
- Responsive design for mobile, tablet, and desktop

<video src="https://5kas5z928t.ufs.sh/f/wBHVA4PQTleAXar1Vcwqs8NZT3UMHvygFezBaGYxK2w6S1In" controls muted playsinline width="100%"></video>

## Usage

Visit [shft.page](https://shft.page) and paste an article URL, or use the shortcut directly:

```text
https://shft.page/https://example.com/article
```

Simply place `shft.page/` before any article URL to open it in Shift's reader mode.

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- shadcn/ui (base-nova style)
- @mendable/firecrawl-js for web scraping
- lingo.dev SDK for translation
- react-markdown, remark-gfm, rehype-highlight, react-syntax-highlighter
- localStorage for caching

## Supported Languages

Spanish (es), French (fr), German (de), Japanese (ja), Chinese (zh), Arabic (ar), Hindi (hi), Portuguese (pt), Russian (ru), Korean (ko), Italian (it), Dutch (nl)

The source language is automatically detected and filtered from the translation options.

## Installation

Prerequisites: Node.js 18+ and pnpm.

```bash
git clone <repository-url>
cd shift-read
pnpm install
```

Create a `.env.local` file:

```env
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
LINGODOTDEV_API_KEY=your_lingodotdev_api_key_here
NEXT_PUBLIC_CLIENT_URL=shft.page
```

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

MIT
