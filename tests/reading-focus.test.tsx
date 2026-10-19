import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingFocus from '@/components/ReadingFocus'
import { collectReadingWords, getReadingWordRects, wordOnAdjacentLine } from '@/lib/readingFocus'

describe('reading word segmentation', () => {
  it('preserves words across inline formatting and skips code and controls', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Read <strong>beau</strong>tiful words, don’t rush.</p><pre>skip code</pre><p>Next<br>line <a href="/">link</a>.</p><button>skip button</button><span hidden>hidden text</span>'
    const words = collectReadingWords(root, 'en')
    expect(words.map(word => word.text)).toEqual(['Read', 'beautiful', 'words', 'don’t', 'rush', 'Next', 'line', 'link'])
    expect(words.map(word => word.range.toString())).toEqual(words.map(word => word.text))
    expect(root.querySelector('strong')?.textContent).toBe('beau')
  })

  it('segments languages without spaces and tolerates invalid language metadata', () => {
    const root = document.createElement('div')
    root.textContent = '这是一个测试。'
    const words = collectReadingWords(root, 'zh')
    expect(words.length).toBeGreaterThan(1)
    expect(words.map(word => word.text).join('')).toBe('这是一个测试')
    expect(() => collectReadingWords(root, 'invalid_language')).not.toThrow()
  })

  it('still finds Unicode words without Intl.Segmenter', () => {
    const original = Intl.Segmenter
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined })
    try {
      const root = document.createElement('div')
      root.textContent = 'Hello café नमस्ते مرحبا'
      expect(collectReadingWords(root).map(word => word.text)).toEqual(['Hello', 'café', 'नमस्ते', 'مرحبا'])
    } finally {
      Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: original })
    }
  })

  it('uses a single marker across inline emphasis and keeps wrapped lines separate', () => {
    const range = document.createRange()
    range.getClientRects = () => [
      new DOMRect(0, 20, 30, 22),
      new DOMRect(30, 20, 20, 22),
      new DOMRect(30, 20, 20, 22),
      new DOMRect(50, 20, 15, 22),
      new DOMRect(0, 48, 20, 22)
    ] as unknown as DOMRectList
    const rects = getReadingWordRects({ text: 'beautiful', range })
    expect(rects.map(rect => [rect.left, rect.top, rect.width, rect.height])).toEqual([
      [0, 20, 65, 22],
      [0, 48, 20, 22]
    ])
  })

  it('moves from the outer line of a wrapped word and finds the word under the horizontal position', () => {
    const words = [
      [new DOMRect(0, 100, 180, 24), new DOMRect(200, 100, 20, 24)],
      [new DOMRect(160, 140, 50, 24), new DOMRect(0, 180, 30, 24)],
      [new DOMRect(0, 220, 140, 24)],
      [new DOMRect(150, 222, 20, 20)],
      [new DOMRect(160, 260, 50, 24)]
    ].map((rects, index) => {
      const range = document.createRange()
      range.getClientRects = () => rects as unknown as DOMRectList
      return { text: String(index), range }
    })
    expect(wordOnAdjacentLine(words, 1, 1)?.index).toBe(2)
    expect(wordOnAdjacentLine(words, 1, -1)?.index).toBe(0)
    expect(wordOnAdjacentLine(words, 1, 1, 160)?.index).toBe(3)
    expect(wordOnAdjacentLine(words, 1, 1, 130)?.index).toBe(2)
  })

  it('chooses the nearest visible line even when document order differs', () => {
    const wordsAt = (rects: DOMRect[][]) => rects.map((wordRects, index) => {
      const range = document.createRange()
      range.getClientRects = () => wordRects as unknown as DOMRectList
      return { text: String(index), range }
    })
    const table = wordsAt([
      [new DOMRect(0, 100, 40, 24)],
      [new DOMRect(0, 140, 40, 24)],
      [new DOMRect(0, 180, 40, 24)],
      [new DOMRect(300, 100, 40, 24)],
      [new DOMRect(0, 220, 40, 24)]
    ])
    expect(wordOnAdjacentLine(table, 3, 1)?.index).toBe(1)
    expect(wordOnAdjacentLine(table, 4, -1, 320)?.index).toBe(2)
    const wrapped = wordsAt([
      [new DOMRect(0, 100, 40, 24)],
      [new DOMRect(60, 100, 140, 24), new DOMRect(0, 140, 30, 24)],
      [new DOMRect(0, 180, 40, 24)]
    ])
    expect(wordOnAdjacentLine(wrapped, 2, -1)?.index).toBe(1)
  })
})

function article(extra = false, contentKey = 'original') {
  return (
    <ReadingFocus contentKey={contentKey} language="en">
      <p>Alpha <strong>beta</strong>, gamma.</p>
      <pre><code>skip code</code></pre>
      <a href="https://example.com">delta</a>
      <input aria-label="Unrelated input" />
      {extra && <p>Epsilon zeta.</p>}
    </ReadingFocus>
  )
}

function enable() {
  const region = screen.getByRole('region', { name: 'Article reading area' })
  fireEvent.doubleClick(region, { clientX: 10, clientY: 210 })
  return region
}

function mockWordPositions(positions: Record<string, [number, number, number?]>) {
  vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
    const position = positions[this.toString()]
    return (position ? [new DOMRect(position[0], position[1], position[2] ?? 45, 24)] : []) as unknown as DOMRectList
  })
}

describe('reading focus interactions', () => {
  beforeEach(() => {
    localStorage.clear()
    window.getSelection()?.removeAllRanges()
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value() {
        if (this.collapsed) return []
        const positions: Record<string, number> = { Alpha: 0, beta: 60, gamma: 120, delta: 180 }
        const left = positions[this.toString()] ?? 240
        return [new DOMRect(left, 200, 45, 24)]
      }
    })
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() { return this.getClientRects()[0] }
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('moves through prose with arrows, clamps at boundaries, and finishes with Escape', async () => {
    render(article())
    const region = enable()
    expect(screen.getByRole('status').textContent).toBe('Word 1 of 4: Alpha')
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(screen.getByRole('status').textContent).toContain('Alpha')
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toBe('Word 2 of 4: beta')
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toBe('Word 4 of 4: delta')
    fireEvent.keyDown(region, { key: 'Escape' })
    expect(screen.queryByRole('status')).toBeNull()
    expect(region).toBe(document.activeElement)
  })

  it('moves by visible line, preserves the column across short lines, and stops at the first and last lines', () => {
    mockWordPositions({ Alpha: [200, 200], beta: [0, 240], gamma: [0, 280], delta: [190, 280, 70] })
    render(article())
    const region = screen.getByRole('region')
    expect(fireEvent.keyDown(region, { key: 'ArrowDown' })).toBe(true)
    fireEvent.doubleClick(region, { clientX: 210, clientY: 210 })
    for (const [key, word] of [
      ['ArrowDown', 'beta'], ['ArrowDown', 'delta'], ['ArrowDown', 'delta'],
      ['ArrowUp', 'beta'], ['ArrowUp', 'Alpha'], ['ArrowUp', 'Alpha']
    ]) {
      expect(fireEvent.keyDown(region, { key })).toBe(false)
      expect(screen.getByRole('status').textContent).toContain(word)
    }
  })

  it('starts a new column after horizontal movement or a click and supports vertical movement from the palette', () => {
    mockWordPositions({
      Alpha: [0, 200], beta: [0, 240], gamma: [200, 240],
      delta: [0, 280], Epsilon: [200, 280], zeta: [200, 320]
    })
    render(article(true))
    const region = screen.getByRole('region')
    fireEvent.doubleClick(region, { clientX: 10, clientY: 210 })
    fireEvent.keyDown(region, { key: 'ArrowDown' })
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    fireEvent.keyDown(region, { key: 'ArrowDown' })
    expect(screen.getByRole('status').textContent).toContain('Epsilon')
    fireEvent.click(region, { clientX: 10, clientY: 290 })
    fireEvent.keyDown(region, { key: 'ArrowUp' })
    fireEvent.keyDown(region, { key: 'ArrowDown' })
    expect(screen.getByRole('status').textContent).toContain('delta')
    fireEvent.keyDown(region, { key: 'c' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'sage highlight' }), { key: 'ArrowDown' })
    expect(screen.getByRole('status').textContent).toContain('zeta')
    expect(screen.queryByRole('group', { name: 'Highlight color' })).toBeNull()
    expect(document.activeElement).toBe(region)
  })

  it('uses the new column after reflow and keeps vertical shortcuts out of interactive elements and modified gestures', () => {
    mockWordPositions({ Alpha: [200, 200], beta: [0, 240], gamma: [0, 900], delta: [190, 900] })
    render(article())
    const region = screen.getByRole('region')
    const bounds = vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 1000))
    fireEvent.doubleClick(region, { clientX: 210, clientY: 210 })
    for (const target of [document.body, screen.getByRole('textbox'), screen.getByRole('link')]) {
      expect(fireEvent.keyDown(target, { key: 'ArrowDown' })).toBe(true)
    }
    for (const modifier of ['shiftKey', 'ctrlKey', 'metaKey', 'altKey']) {
      expect(fireEvent.keyDown(region, { key: 'ArrowDown', [modifier]: true })).toBe(true)
    }
    expect(screen.getByRole('status').textContent).toContain('Alpha')
    fireEvent.keyDown(region, { key: 'ArrowDown' })
    bounds.mockReturnValue(new DOMRect(0, 0, 200, 1000))
    fireEvent.keyDown(region, { key: 'ArrowDown' })
    expect(screen.getByRole('status').textContent).toContain('gamma')
    expect(window.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }))
  })

  it('starts on the double-clicked word, moves on a single click, and removes on double-click', () => {
    const { container } = render(article())
    const region = screen.getByRole('region')
    expect(container.querySelector('.reading-focus-toolbar')).toBeNull()
    fireEvent.click(region, { clientX: 70, clientY: 210 })
    expect(screen.queryByRole('status')).toBeNull()
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(region.querySelector('strong')!)
    selection.addRange(range)
    fireEvent.doubleClick(region, { clientX: 70, clientY: 210 })
    expect(screen.getByRole('status').textContent).toBe('Word 2 of 4: beta')
    expect(selection.isCollapsed).toBe(true)
    fireEvent.click(region, { clientX: 130, clientY: 210 })
    expect(screen.getByRole('status').textContent).toBe('Word 3 of 4: gamma')
    fireEvent.doubleClick(region, { clientX: 130, clientY: 210 })
    expect(container.querySelector('.reading-focus-mark')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(region, { clientX: 10, clientY: 210 })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('offers keyboard activation without a visible control and ignores double-clicks on interactive content', () => {
    render(article())
    const region = screen.getByRole('region')
    fireEvent.doubleClick(screen.getByRole('link'), { clientX: 190, clientY: 210 })
    fireEvent.doubleClick(screen.getByRole('textbox'), { clientX: 10, clientY: 210 })
    fireEvent.doubleClick(region.querySelector('code')!, { clientX: 10, clientY: 210 })
    fireEvent.doubleClick(region, { clientX: 500, clientY: 500 })
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.keyDown(region, { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toContain('Alpha')
    fireEvent.keyDown(region, { key: 'Enter' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('leaves shortcuts outside the article, editable fields, links, and selection gestures alone', () => {
    render(article())
    const region = enable()
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('link'), { key: 'ArrowRight' })
    fireEvent.keyDown(region, { key: 'ArrowRight', shiftKey: true })
    expect(screen.getByRole('status').textContent).toContain('Alpha')
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(region.querySelector('p')!)
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.click(region, { clientX: 70, clientY: 210 })
    expect(screen.getByRole('status').textContent).toContain('Alpha')
    selection.removeAllRanges()
    fireEvent.click(region, { clientX: 70, clientY: 210 })
    expect(screen.getByRole('status').textContent).toContain('beta')
  })

  it('preserves the current word when another section arrives and resets for a different language', async () => {
    const { rerender } = render(article())
    const region = enable()
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    rerender(article(true))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Word 2 of 6: beta'))
    rerender(article(true, 'translation'))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Word 1 of 6: Alpha'))
    fireEvent.doubleClick(region, { clientX: 10, clientY: 210 })
    rerender(article(false, 'other-article'))
    enable()
    expect(screen.getByRole('status').textContent).toBe('Word 1 of 4: Alpha')
  })

  it('resumes the last word with Enter but restarts after the content changes while stopped', () => {
    const { rerender } = render(article())
    const region = enable()
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    fireEvent.keyDown(region, { key: 'Escape' })
    fireEvent.keyDown(region, { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toBe('Word 2 of 4: beta')
    fireEvent.keyDown(region, { key: 'Escape' })
    rerender(article(false, 'translation'))
    fireEvent.keyDown(region, { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toBe('Word 1 of 4: Alpha')
  })

  it('opens the palette while hovering near the active word and hides it after leaving', () => {
    vi.useFakeTimers()
    try {
      render(article())
      const region = enable()
      fireEvent.pointerMove(region, { pointerType: 'mouse', clientX: 47, clientY: 210 })
      act(() => { vi.advanceTimersByTime(350) })
      expect(screen.getAllByRole('button')).toHaveLength(5)
      fireEvent.pointerMove(region, { pointerType: 'mouse', clientX: 70, clientY: 210 })
      act(() => { vi.advanceTimersByTime(220) })
      expect(screen.queryByRole('group', { name: 'Highlight color' })).toBeNull()
      fireEvent.pointerMove(region, { pointerType: 'touch', clientX: 10, clientY: 210 })
      act(() => { vi.advanceTimersByTime(350) })
      expect(screen.queryByRole('group', { name: 'Highlight color' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers keyboard-accessible colors, remembers the choice, and returns focus on Escape', async () => {
    const { unmount } = render(article())
    const region = enable()
    fireEvent.keyDown(region, { key: 'c' })
    expect(screen.getAllByRole('button')).toHaveLength(5)
    const honey = screen.getByRole('button', { name: 'honey highlight' })
    fireEvent.click(honey)
    expect(localStorage.getItem('shift_focus_color')).toBe('honey')
    expect(region.closest('.reading-focus')?.getAttribute('data-focus-color')).toBe('honey')
    fireEvent.keyDown(honey, { key: 'ArrowRight' })
    expect(screen.queryByRole('button', { name: 'honey highlight' })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Word 2 of 4: beta')
    fireEvent.keyDown(region, { key: 'c' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'honey highlight' }), { key: 'Escape' })
    expect(document.activeElement).toBe(region)
    unmount()
    render(article())
    enable()
    await act(async () => {})
    expect(screen.getByRole('region').closest('.reading-focus')?.getAttribute('data-focus-color')).toBe('honey')
  })

  it('reattaches the marker when the renderer replaces unchanged text nodes', async () => {
    const fixture = (key: string) => (
      <ReadingFocus contentKey="article">
        <p key={key}>Alpha beta gamma.</p>
      </ReadingFocus>
    )
    const { rerender, container } = render(fixture('before'))
    const region = enable()
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    rerender(fixture('after'))
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    expect(screen.getByRole('status').textContent).toBe('Word 2 of 3: beta')
    expect(container.querySelector('.reading-focus-mark')).not.toBeNull()
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(screen.getByRole('status').textContent).toBe('Word 3 of 3: gamma')
  })
})
