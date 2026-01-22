'use server'

export interface ArticleData {
  markdown: string
  metadata: {
    title?: string
    author?: string
    publishedTime?: string
    ogImage?: string
    language?: string
  }
}

export async function fetchContent(url: string): Promise<{
  success: boolean
  data?: ArticleData
  error?: string
}> {
  await new Promise((resolve) => setTimeout(resolve, 2500))

  const mockArticle: ArticleData = {
    markdown: `# The Art of Staying in Touch

On modern friendship and staying close as life widens.

> "We are each other's harvest; we are each other's business; we are each other's magnitude and bond." —Gwendolyn Brooks

Last week, I called my dear friend O, who lives oceans away, and we found ourselves reflecting on how keeping in touch becomes harder as our lives stretch. As the years go by, your world expands across cities, countries, and continents. The people who once shared your daily rhythm now exist in different time zones, different seasons, different realities.

## The Challenge of Distance

The challenge isn't just geographical—it's temporal and emotional. When you're building a career, starting a family, or simply trying to keep your head above water, maintaining friendships requires intentional effort. The spontaneous coffee dates, the impromptu walks, the "just dropping by" moments become rare luxuries.

### What We've Learned

1. **Schedule regular check-ins**: Even if it's just a monthly video call, having it on the calendar makes it happen.

2. **Share the mundane**: Sometimes the most meaningful connections come from sharing the small moments—a photo of your lunch, a song that reminded you of them, a random thought.

3. **Be present when you're together**: When you do get time together, whether in person or virtually, be fully there. Put away the phone, close the laptop, and just be.

4. **Accept that relationships evolve**: Not every friendship needs to be maintained at the same intensity. Some friendships are seasonal, and that's okay.

## The Value of Deep Connections

In a world that often feels disconnected despite being hyper-connected, the friendships that survive distance and time are precious. They remind us that we're not alone, that someone out there knows us deeply, and that connection transcends physical proximity.

These relationships teach us about commitment, about showing up even when it's inconvenient, and about the beauty of growing together while growing apart.

## Conclusion

Staying in touch is an art—one that requires patience, intention, and grace. It's not about maintaining every relationship at the same level, but about recognizing which connections matter most and investing in them, even when life gets complicated.

The effort is worth it. Because in the end, these are the relationships that shape us, that remind us who we are, and that make the journey meaningful.`,
    metadata: {
      title: 'The Art of Staying in Touch',
      author: 'Maja',
      publishedTime: '2025-10-28T00:00:00Z',
      ogImage: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&h=630&fit=crop',
      language: 'en',
    },
  }

  return {
    success: true,
    data: mockArticle,
  }
}
