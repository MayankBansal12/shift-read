'use client'

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { collectReadingWords, getReadingWordRects, isPointInWord, wordAtPoint, wordOnAdjacentLine, type ReadingWord } from '@/lib/readingFocus'
import './ReadingFocus.css'

type FocusColor = 'sage' | 'honey' | 'sky' | 'rose' | 'lavender'

interface ReadingFocusProps {
  children: ReactNode
  contentKey: string
  language?: string
}

interface MarkRect {
  top: number
  left: number
  width: number
  height: number
}

const FOCUS_COLORS: FocusColor[] = ['sage', 'honey', 'sky', 'rose', 'lavender']
const colorStorageKey = 'shift_focus_color'
const interactiveElements = 'a, button, input, textarea, select, pre, code, video, audio, [contenteditable="true"], [role="slider"], [role="combobox"]'

function hasModifier(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
}

function isInteractive(target: EventTarget) {
  return target instanceof Element && !!target.closest(interactiveElements)
}

export default function ReadingFocus({ children, contentKey, language }: ReadingFocusProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<ReadingWord[]>([])
  const indexRef = useRef(0)
  const columnRef = useRef<{ x: number; width: number } | null>(null)
  const contentKeyRef = useRef(contentKey)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [color, setColor] = useState<FocusColor>('sage')
  const [current, setCurrent] = useState({ index: 0, text: '', total: 0 })
  const [rects, setRects] = useState<MarkRect[]>([])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [palettePosition, setPalettePosition] = useState({ left: 0, top: 0, above: true })
  const hintId = useId()
  const statusId = useId()

  const clearTimers = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hoverTimerRef.current = null
    hideTimerRef.current = null
  }, [])

  const collectWords = useCallback(() => {
    wordsRef.current = contentRef.current ? collectReadingWords(contentRef.current, language) : []
    if (contentKeyRef.current !== contentKey) {
      contentKeyRef.current = contentKey
      indexRef.current = 0
      columnRef.current = null
      setPaletteOpen(false)
    }
    return wordsRef.current
  }, [contentKey, language])

  const measure = useCallback(() => {
    const root = rootRef.current
    const word = wordsRef.current[indexRef.current]
    if (!root || !word) {
      setRects([])
      return
    }
    const bounds = root.getBoundingClientRect()
    const wordRects = getReadingWordRects(word)
    setRects(wordRects.map(rect => ({
      left: rect.left - bounds.left,
      top: rect.top - bounds.top,
      width: rect.width,
      height: rect.height
    })))
    const anchor = wordRects[0]
    if (anchor) {
      const width = paletteRef.current?.offsetWidth || 168
      const height = paletteRef.current?.offsetHeight || 42
      const above = anchor.top > height + 80
      setPalettePosition({
        left: Math.max(0, Math.min(anchor.left - bounds.left + anchor.width / 2 - width / 2, bounds.width - width)),
        top: (above ? anchor.top : anchor.bottom) - bounds.top + (above ? -10 : 10),
        above
      })
    }
  }, [])

  const activateWord = useCallback((index: number, scroll = false) => {
    const words = wordsRef.current
    indexRef.current = Math.max(0, Math.min(index, words.length - 1))
    const word = words[indexRef.current]
    setCurrent({ index: indexRef.current, text: word?.text ?? '', total: words.length })
    if (scroll && word) {
      const bounds = word.range.getBoundingClientRect()
      if (bounds.top < 96 || bounds.bottom > window.innerHeight - 64) {
        window.scrollBy({ top: bounds.top - window.innerHeight / 2 + bounds.height / 2, behavior: 'instant' })
      }
    }
    measure()
  }, [measure])

  useEffect(() => {
    const content = contentRef.current
    if (!enabled || !content) return
    let frame = 0
    const refresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        collectWords()
        activateWord(indexRef.current)
      })
    }
    const observer = new MutationObserver(refresh)
    observer.observe(content, { childList: true, characterData: true, subtree: true })
    refresh()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [enabled, collectWords, activateWord])

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    let cancelled = false
    const refresh = () => {
      if (cancelled) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const root = rootRef.current
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null
    if (root) observer?.observe(root)
    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, true)
    root?.addEventListener('load', refresh, true)
    void document.fonts?.ready.then(refresh)
    refresh()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh, true)
      root?.removeEventListener('load', refresh, true)
    }
  }, [enabled, paletteOpen, measure])

  useEffect(() => clearTimers, [clearTimers])

  function closePalette(focus = false) {
    clearTimers()
    setPaletteOpen(false)
    if (focus) contentRef.current?.focus({ preventScroll: true })
  }

  function openPalette(focus = false) {
    clearTimers()
    setPaletteOpen(true)
    if (focus) requestAnimationFrame(() => paletteRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus())
  }

  function start(index: number, scroll = false) {
    columnRef.current = null
    try {
      const saved = localStorage.getItem(colorStorageKey)
      if (FOCUS_COLORS.includes(saved as FocusColor)) setColor(saved as FocusColor)
    } catch {}
    activateWord(index, scroll)
    setEnabled(true)
  }

  function stop() {
    closePalette()
    setEnabled(false)
  }

  function move(key: string) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return false
    closePalette()
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      columnRef.current = null
      activateWord(indexRef.current + (key === 'ArrowRight' ? 1 : -1), true)
    } else {
      const bounds = contentRef.current?.getBoundingClientRect()
      if (bounds) {
        const column = columnRef.current
        const next = wordOnAdjacentLine(wordsRef.current, indexRef.current, key === 'ArrowDown' ? 1 : -1,
          column?.width === bounds.width ? column.x + bounds.left : undefined)
        if (next) {
          columnRef.current = { x: next.x - bounds.left, width: bounds.width }
          activateWord(next.index, true)
        }
      }
    }
    return true
  }

  function changeColor(nextColor: FocusColor) {
    setColor(nextColor)
    try {
      localStorage.setItem(colorStorageKey, nextColor)
    } catch {}
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || hasModifier(event) || isInteractive(event.target)) return
    if (event.key === 'Enter') {
      event.preventDefault()
      if (enabled) stop()
      else if (collectWords().length > 0) start(indexRef.current, true)
      return
    }
    if (!enabled) return
    if (move(event.key)) {
      event.preventDefault()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (paletteOpen) closePalette(true)
      else stop()
    } else if (event.key.toLowerCase() === 'c') {
      event.preventDefault()
      openPalette(true)
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!enabled || event.detail > 1 || window.getSelection()?.isCollapsed === false || isInteractive(event.target)) return
    const index = wordAtPoint(wordsRef.current, event.clientX, event.clientY)
    if (index < 0) return
    columnRef.current = null
    if (index === indexRef.current) openPalette()
    else {
      closePalette()
      activateWord(index)
    }
    contentRef.current?.focus({ preventScroll: true })
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (hasModifier(event) || isInteractive(event.target)) return
    const words = enabled ? wordsRef.current : collectWords()
    const index = wordAtPoint(words, event.clientX, event.clientY)
    if (index < 0) return
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    if (enabled) stop()
    else start(index)
    contentRef.current?.focus({ preventScroll: true })
  }

  function scheduleHide() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
    if (hideTimerRef.current) return
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null
      if (!paletteRef.current?.contains(document.activeElement)) setPaletteOpen(false)
    }, 220)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType === 'touch') return
    const word = wordsRef.current[indexRef.current]
    if (word && isPointInWord(word, event.clientX, event.clientY, 3)) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
      if (!paletteOpen && !hoverTimerRef.current) hoverTimerRef.current = setTimeout(() => openPalette(), 350)
    } else scheduleHide()
  }

  return (
    <div ref={rootRef} className="reading-focus" data-focus-color={color} data-focus-enabled={enabled}>
      <span id={hintId} className="sr-only">
        Double-click a word or press Enter to toggle highlighting. Click a word to move, use left and right arrows to move by word, or up and down arrows to move by line. Hover the highlight or press C to choose a color. Press Escape to finish.
      </span>
      {enabled && rects.map((rect, index) => (
        <span key={index} className="reading-focus-mark" aria-hidden="true" style={rect} />
      ))}
      <div
        ref={contentRef}
        className="reading-focus-content prose prose-sm dark:prose-invert max-w-none"
        role="region"
        aria-label="Article reading area"
        aria-describedby={enabled ? `${hintId} ${statusId}` : hintId}
        aria-keyshortcuts={enabled ? 'Enter ArrowLeft ArrowRight ArrowUp ArrowDown Escape C' : 'Enter'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={scheduleHide}
      >
        {children}
      </div>
      {enabled && (
        <span id={statusId} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {current.total > 0 ? `Word ${current.index + 1} of ${current.total}: ${current.text}` : 'No readable words in this section yet.'}
        </span>
      )}
      {enabled && paletteOpen && current.total > 0 && (
        <div
          ref={paletteRef}
          className="reading-focus-popover"
          style={{ left: palettePosition.left, top: palettePosition.top, transform: palettePosition.above ? 'translateY(-100%)' : undefined }}
          onPointerEnter={clearTimers}
          onPointerLeave={scheduleHide}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) closePalette()
          }}
          onKeyDown={event => {
            if (hasModifier(event)) return
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              closePalette(true)
            } else if (move(event.key)) {
              event.preventDefault()
              event.stopPropagation()
              contentRef.current?.focus({ preventScroll: true })
            }
          }}
        >
          <div role="group" aria-label="Highlight color" className="reading-focus-palette">
            {FOCUS_COLORS.map(option => (
              <button
                key={option}
                type="button"
                data-color={option}
                aria-pressed={option === color}
                aria-label={`${option} highlight`}
                title={option}
                onClick={() => changeColor(option)}
                className="reading-focus-swatch"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
