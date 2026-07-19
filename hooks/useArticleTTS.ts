'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { synthesizeSpeech } from '@/app/actions/tts'
import { ArticleTooLongError, chunkText } from '@/lib/tts/chunker'
import { charCount, readingTimeMin, wordCount } from '@/lib/tts/readingTime'
import { PREFETCH_LEAD_S, VOICE } from '@/lib/tts/constants'
import { stripMarkdown } from '@/lib/tts/stripMarkdown'

function friendlyErrorMessage(raw: string): string {
  if (raw.includes('timed out')) return 'Speech generation took too long. Try again.'
  if (raw.includes('Groq API key')) return 'Speech service is unavailable right now. Try again later.'
  if (raw.includes('Groq 401')) return 'Speech service is unavailable right now. Try again later.'
  if (raw.includes('Groq 500')) return 'Speech service encountered an error. Try again.'
  if (raw.includes('Groq 429')) return 'Speech service is busy. Try again in a moment.'
  if (raw.includes('Groq')) return 'Speech service had a problem. Try again.'
  return 'Something went wrong generating speech. Try again.'
}

export type TTSState =
  | { kind: 'idle' }
  | { kind: 'loading'; chunkIdx: 0 }
  | { kind: 'playing'; chunkIdx: number; currentTime: number }
  | { kind: 'paused'; chunkIdx: number; currentTime: number }
  | { kind: 'buffering'; chunkIdx: number }
  | { kind: 'ended' }
  | { kind: 'error'; message: string; chunkIdx?: number }

export type TTSAction =
  | { type: 'CLICK' }
  | { type: 'FETCHED'; chunkIdx: number; blob: Blob }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TIME'; currentTime: number }
  | { type: 'ENDED_NEXT'; chunkIdx: number }
  | { type: 'NEXT_CHUNK' }
  | { type: 'ENDED_ALL' }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' }
  | { type: 'VOLUME'; value: number }
  | { type: 'MUTE_TOGGLE' }

export function reduce(state: TTSState, action: TTSAction): TTSState {
  switch (action.type) {
    case 'CLICK': {
      if (
        state.kind === 'idle' ||
        state.kind === 'ended' ||
        state.kind === 'error'
      ) {
        return { kind: 'loading', chunkIdx: 0 }
      }
      if (state.kind === 'playing') {
        return { kind: 'paused', chunkIdx: state.chunkIdx, currentTime: state.currentTime }
      }
      if (state.kind === 'paused') {
        return { kind: 'playing', chunkIdx: state.chunkIdx, currentTime: state.currentTime }
      }
      return state
    }
    case 'PLAY': {
      if (state.kind === 'paused') {
        return { kind: 'playing', chunkIdx: state.chunkIdx, currentTime: state.currentTime }
      }
      return state
    }
    case 'PAUSE': {
      if (state.kind === 'playing') {
        return { kind: 'paused', chunkIdx: state.chunkIdx, currentTime: state.currentTime }
      }
      return state
    }
    case 'TIME': {
      if (state.kind === 'playing') {
        return { kind: 'playing', chunkIdx: state.chunkIdx, currentTime: action.currentTime }
      }
      return state
    }
    case 'FETCHED': {
      if (state.kind === 'loading' && action.chunkIdx === 0) {
        return { kind: 'playing', chunkIdx: 0, currentTime: 0 }
      }
      if (state.kind === 'buffering' && action.chunkIdx === state.chunkIdx + 1) {
        return { kind: 'playing', chunkIdx: action.chunkIdx, currentTime: 0 }
      }
      return state
    }
    case 'ENDED_NEXT': {
      if (state.kind === 'playing' && action.chunkIdx === state.chunkIdx) {
        return { kind: 'buffering', chunkIdx: state.chunkIdx }
      }
      return state
    }
    case 'NEXT_CHUNK': {
      if (state.kind === 'playing') {
        return { kind: 'playing', chunkIdx: state.chunkIdx + 1, currentTime: 0 }
      }
      return state
    }
    case 'ENDED_ALL': {
      return { kind: 'ended' }
    }
    case 'ERROR': {
      const idx =
        state.kind === 'playing' ||
        state.kind === 'paused' ||
        state.kind === 'buffering' ||
        state.kind === 'loading'
          ? state.chunkIdx
          : undefined
      return { kind: 'error', message: action.message, chunkIdx: idx }
    }
    case 'RESET': {
      return { kind: 'idle' }
    }
    case 'VOLUME':
    case 'MUTE_TOGGLE':
      return state
    default:
      return state
  }
}

export interface UseArticleTTSOptions {
  text: string
  disabled?: boolean
}

export interface UseArticleTTSResult {
  state: TTSState
  audioRef: React.RefObject<HTMLAudioElement | null>
  chunks: string[]
  tooLong: boolean
  empty: boolean
  words: number
  chars: number
  readingMinutes: number
  volume: number
  onToggle: () => void
  onVolumeChange: (v: number) => void
  onMuteToggle: () => void
  reset: () => void
}

export function useArticleTTS({ text, disabled = false }: UseArticleTTSOptions): UseArticleTTSResult {
  const [state, dispatch] = useReducer(reduce, { kind: 'idle' } as TTSState)
  const [volume, setVolume] = useState(1)

  const stateRef = useRef(state)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const prefetchedRef = useRef<Map<number, Blob>>(new Map())
  const inFlightRef = useRef<{ idx: number; ctrl: AbortController } | null>(null)
  const lastVolumeRef = useRef(1)
  const lastPlayedChunkRef = useRef<number | null>(null)
  const lastTimeUpdateRef = useRef(0)
  const currentUrlRef = useRef<string | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const chunkInfo = useMemo(() => {
    if (disabled) return { chunks: [] as string[], error: null as string | null }
    try {
      return { chunks: chunkText(text), error: null as string | null }
    } catch (e) {
      if (e instanceof ArticleTooLongError) {
        return { chunks: [] as string[], error: e.message }
      }
      return { chunks: [] as string[], error: 'Failed to chunk article' }
    }
  }, [text, disabled])

  const chunks = chunkInfo.chunks
  const tooLong = !!chunkInfo.error
  const empty = chunks.length === 0 && !tooLong

  const plainText = useMemo(() => stripMarkdown(text), [text])

  const words = useMemo(() => wordCount(plainText), [plainText])
  const chars = useMemo(() => charCount(plainText), [plainText])
  const readingMinutes = useMemo(() => readingTimeMin(plainText), [plainText])

  const cleanupCurrentUrl = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current)
      currentUrlRef.current = null
    }
  }, [])

  const swapAndPlay = useCallback(
    (idx: number) => {
      const audio = audioRef.current
      if (!audio) return
      const blob = prefetchedRef.current.get(idx)
      if (!blob) return

      cleanupCurrentUrl()
      const url = URL.createObjectURL(blob)
      currentUrlRef.current = url

      audio.src = url
      audio.currentTime = 0
      lastPlayedChunkRef.current = idx
      audio.play().catch((e: Error) => {
        if (e.name === 'AbortError') return
        dispatch({ type: 'ERROR', message: 'Tap play to start (browser blocked autoplay)' })
      })
    },
    [cleanupCurrentUrl]
  )

  const dispatchFetch = useCallback(
    (idx: number) => {
      if (prefetchedRef.current.has(idx)) return
      if (inFlightRef.current) return
      if (idx < 0 || idx >= chunks.length) return

      const ctrl = new AbortController()
      inFlightRef.current = { idx, ctrl }
      const chunkText = chunks[idx]

      synthesizeSpeech({ text: chunkText, voice: VOICE })
        .then(result => {
          if (ctrl.signal.aborted) return
          inFlightRef.current = null
          if (result.success) {
            prefetchedRef.current.set(idx, result.blob)
            dispatch({ type: 'FETCHED', chunkIdx: idx, blob: result.blob })
          } else {
            dispatch({ type: 'ERROR', message: friendlyErrorMessage(result.error) })
          }
        })
        .catch((e: Error) => {
          if (ctrl.signal.aborted) return
          inFlightRef.current = null
          if (e.name === 'AbortError') return
          dispatch({ type: 'ERROR', message: e.message })
        })
    },
    [chunks]
  )

  const reset = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
    }
    cleanupCurrentUrl()
    prefetchedRef.current.clear()
    if (inFlightRef.current) {
      inFlightRef.current.ctrl.abort()
      inFlightRef.current = null
    }
    lastPlayedChunkRef.current = null
    dispatch({ type: 'RESET' })
  }, [cleanupCurrentUrl])

  useEffect(() => {
    if (state.kind === 'loading' && state.chunkIdx === 0) {
      prefetchedRef.current.clear()
      dispatchFetch(0)
    }
  }, [state, dispatchFetch])

  useEffect(() => {
    if (state.kind !== 'playing') {
      if (state.kind === 'idle' || state.kind === 'ended' || state.kind === 'error') {
        lastPlayedChunkRef.current = null
      }
      return
    }
    const audio = audioRef.current
    if (!audio) return

    if (lastPlayedChunkRef.current !== state.chunkIdx) {
      const blob = prefetchedRef.current.get(state.chunkIdx)
      if (!blob) return
      swapAndPlay(state.chunkIdx)
    } else if (audio.paused) {
      audio.play().catch((e: Error) => {
        if (e.name === 'AbortError') return
        dispatch({ type: 'ERROR', message: 'Tap play to start (browser blocked autoplay)' })
      })
    }
  }, [state, swapAndPlay])

  useEffect(() => {
    if (state.kind === 'error') {
      const audio = audioRef.current
      audio?.pause()
      cleanupCurrentUrl()
      if (inFlightRef.current) {
        inFlightRef.current.ctrl.abort()
        inFlightRef.current = null
      }
      prefetchedRef.current.clear()
      lastPlayedChunkRef.current = null
    }
    if (state.kind === 'ended') {
      cleanupCurrentUrl()
      prefetchedRef.current.clear()
      lastPlayedChunkRef.current = null
    }
  }, [state, cleanupCurrentUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      const now = Date.now()
      if (now - lastTimeUpdateRef.current < 250) return
      lastTimeUpdateRef.current = now

      const s = stateRef.current
      if (s.kind !== 'playing') return
      if (!isFinite(audio.duration)) return
      if (audio.currentTime < audio.duration - PREFETCH_LEAD_S) return
      if (s.chunkIdx + 1 >= chunks.length) return
      if (prefetchedRef.current.has(s.chunkIdx + 1)) return
      if (inFlightRef.current) return
      dispatchFetch(s.chunkIdx + 1)
    }

    const onEnded = () => {
      const s = stateRef.current
      if (s.kind !== 'playing') return
      const idx = s.chunkIdx
      const nextIdx = idx + 1
      if (nextIdx >= chunks.length) {
        dispatch({ type: 'ENDED_ALL' })
        return
      }
      if (prefetchedRef.current.has(nextIdx)) {
        swapAndPlay(nextIdx)
        dispatch({ type: 'NEXT_CHUNK' })
        return
      }
      dispatch({ type: 'ENDED_NEXT', chunkIdx: idx })
      dispatchFetch(nextIdx)
    }

    const onErrorEvent = (e: Event) => {
      const target = e.target as HTMLAudioElement
      if (target.error) {
        dispatch({
          type: 'ERROR',
          message: target.error.message || `Audio error code ${target.error.code}`,
        })
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onErrorEvent)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onErrorEvent)
    }
  }, [chunks.length, dispatchFetch, swapAndPlay])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  useEffect(() => {
    const s = stateRef.current
    if (s.kind === 'idle' || s.kind === 'ended' || s.kind === 'error') return
    reset()
  }, [text, reset])

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      cleanupCurrentUrl()
      // eslint-disable-next-line react-hooks/exhaustive-deps
      prefetchedRef.current.clear()
      if (inFlightRef.current) {
        inFlightRef.current.ctrl.abort()
        inFlightRef.current = null
      }
    }
  }, [cleanupCurrentUrl])

  const onToggle = useCallback(() => {
    const audio = audioRef.current
    const s = stateRef.current

    if (s.kind === 'idle' || s.kind === 'ended' || s.kind === 'error') {
      dispatch({ type: 'CLICK' })
      return
    }
    if (s.kind === 'playing') {
      audio?.pause()
      dispatch({ type: 'CLICK' })
      return
    }
    if (s.kind === 'paused') {
      audio?.play().catch((e: Error) => {
        if (e.name === 'AbortError') return
        dispatch({ type: 'ERROR', message: 'Tap play to start (browser blocked autoplay)' })
      })
      dispatch({ type: 'CLICK' })
      return
    }
  }, [])

  const onVolumeChange = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    if (clamped > 0) lastVolumeRef.current = clamped
    setVolume(clamped)
  }, [])

  const onMuteToggle = useCallback(() => {
    setVolume(prev => {
      if (prev === 0) return lastVolumeRef.current || 1
      lastVolumeRef.current = prev
      return 0
    })
  }, [])

  return {
    state,
    audioRef,
    chunks,
    tooLong,
    empty,
    words,
    chars,
    readingMinutes,
    volume,
    onToggle,
    onVolumeChange,
    onMuteToggle,
    reset,
  }
}
