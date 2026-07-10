/* eslint-disable react-hooks/refs */
import { act, fireEvent, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reduce, useArticleTTS, type UseArticleTTSResult } from '@/hooks/useArticleTTS'
import { synthesizeSpeech } from '@/app/actions/tts'

vi.mock('@/app/actions/tts', () => ({
  synthesizeSpeech: vi.fn(),
}))

const mockSynth = vi.mocked(synthesizeSpeech)

const lastTTSRef: { current: UseArticleTTSResult | null } = { current: null }

function TestComponent({ text }: { text: string }) {
  const tts = useArticleTTS({ text })
  useEffect(() => {
    lastTTSRef.current = tts
  })
  return (
    <div>
      <audio ref={tts.audioRef} data-testid="audio" />
      <button onClick={tts.onToggle} data-testid="toggle">Toggle</button>
    </div>
  )
}

function successResult(blob: Blob = new Blob(['x'])) {
  return { success: true as const, blob, mimeType: 'audio/wav', cached: false }
}

beforeEach(() => {
  mockSynth.mockReset()
  lastTTSRef.current = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('reduce', () => {
  it('CLICK from idle → loading(0)', () => {
    expect(reduce({ kind: 'idle' }, { type: 'CLICK' })).toEqual({ kind: 'loading', chunkIdx: 0 })
  })

  it('CLICK from ended → loading(0)', () => {
    expect(reduce({ kind: 'ended' }, { type: 'CLICK' })).toEqual({ kind: 'loading', chunkIdx: 0 })
  })

  it('CLICK from error → loading(0) (Retry)', () => {
    expect(
      reduce({ kind: 'error', message: 'boom', chunkIdx: 0 }, { type: 'CLICK' })
    ).toEqual({ kind: 'loading', chunkIdx: 0 })
  })

  it('CLICK from playing → paused', () => {
    const state = { kind: 'playing' as const, chunkIdx: 2, currentTime: 5 }
    expect(reduce(state, { type: 'CLICK' })).toEqual({ kind: 'paused', chunkIdx: 2, currentTime: 5 })
  })

  it('CLICK from paused → playing', () => {
    const state = { kind: 'paused' as const, chunkIdx: 2, currentTime: 5 }
    expect(reduce(state, { type: 'CLICK' })).toEqual({ kind: 'playing', chunkIdx: 2, currentTime: 5 })
  })

  it('CLICK from loading is a no-op', () => {
    const state = { kind: 'loading' as const, chunkIdx: 0 }
    expect(reduce(state, { type: 'CLICK' })).toBe(state)
  })

  it('CLICK from buffering is a no-op', () => {
    const state = { kind: 'buffering' as const, chunkIdx: 1 }
    expect(reduce(state, { type: 'CLICK' })).toBe(state)
  })

  it('FETCHED chunkIdx=0 from loading(0) → playing(0, 0)', () => {
    const state = { kind: 'loading' as const, chunkIdx: 0 }
    expect(reduce(state, { type: 'FETCHED', chunkIdx: 0, blob: new Blob() })).toEqual({
      kind: 'playing',
      chunkIdx: 0,
      currentTime: 0,
    })
  })

  it('FETCHED chunkIdx=N+1 from buffering → playing(N+1, 0)', () => {
    const state = { kind: 'buffering' as const, chunkIdx: 1 }
    expect(reduce(state, { type: 'FETCHED', chunkIdx: 2, blob: new Blob() })).toEqual({
      kind: 'playing',
      chunkIdx: 2,
      currentTime: 0,
    })
  })

  it('ENDED_NEXT from playing → buffering', () => {
    const state = { kind: 'playing' as const, chunkIdx: 0, currentTime: 5 }
    expect(reduce(state, { type: 'ENDED_NEXT', chunkIdx: 0 })).toEqual({
      kind: 'buffering',
      chunkIdx: 0,
    })
  })

  it('ENDED_ALL → ended', () => {
    const state = { kind: 'playing' as const, chunkIdx: 0, currentTime: 5 }
    expect(reduce(state, { type: 'ENDED_ALL' })).toEqual({ kind: 'ended' })
  })

  it('ERROR preserves chunkIdx when in an active state', () => {
    const state = { kind: 'playing' as const, chunkIdx: 3, currentTime: 5 }
    expect(reduce(state, { type: 'ERROR', message: 'boom' })).toEqual({
      kind: 'error',
      message: 'boom',
      chunkIdx: 3,
    })
  })

  it('ERROR from idle has no chunkIdx', () => {
    expect(reduce({ kind: 'idle' }, { type: 'ERROR', message: 'boom' })).toEqual({
      kind: 'error',
      message: 'boom',
      chunkIdx: undefined,
    })
  })

  it('RESET → idle', () => {
    const state = { kind: 'playing' as const, chunkIdx: 1, currentTime: 5 }
    expect(reduce(state, { type: 'RESET' })).toEqual({ kind: 'idle' })
  })
})

describe('useArticleTTS', () => {
  it('starts in idle state', () => {
    mockSynth.mockResolvedValue(successResult())
    render(<TestComponent text="Hello world." />)
    expect(lastTTSRef.current?.state.kind).toBe('idle')
  })

  it('idle → click → loading', async () => {
    mockSynth.mockResolvedValue(successResult())
    const { getByTestId } = render(<TestComponent text="Hello world." />)
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    expect(lastTTSRef.current?.state.kind).toBe('loading')
  })

  it('loading → FETCHED 0 → playing(0)', async () => {
    mockSynth.mockResolvedValue(successResult())
    const { getByTestId } = render(<TestComponent text="Hello world." />)
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockSynth).toHaveBeenCalledTimes(1)
    expect(lastTTSRef.current?.state.kind).toBe('playing')
    if (lastTTSRef.current?.state.kind === 'playing') {
      expect(lastTTSRef.current.state.chunkIdx).toBe(0)
    }
  })

  it('playing → click → paused', async () => {
    mockSynth.mockResolvedValue(successResult())
    const { getByTestId } = render(<TestComponent text="Hello world." />)
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(lastTTSRef.current?.state.kind).toBe('playing')
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    expect(lastTTSRef.current?.state.kind).toBe('paused')
  })

  it('paused: timeupdate prefetch is skipped (no new fetch on pause)', async () => {
    const longText = Array.from(
      { length: 200 },
      (_, i) => `Sentence number ${i} for the article body with some additional content to make it longer.`
    ).join(' ')
    mockSynth.mockResolvedValue(successResult())
    const { getByTestId } = render(<TestComponent text={longText} />)
    const audio = getByTestId('audio') as HTMLAudioElement
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(lastTTSRef.current?.state.kind).toBe('playing')
    expect(mockSynth).toHaveBeenCalledTimes(1)
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    expect(lastTTSRef.current?.state.kind).toBe('paused')
    act(() => {
      Object.defineProperty(audio, 'duration', { configurable: true, value: 100 })
      Object.defineProperty(audio, 'currentTime', { configurable: true, value: 99 })
      audio.dispatchEvent(new Event('timeupdate'))
    })
    expect(mockSynth).toHaveBeenCalledTimes(1)
  })

  it('paused → click → playing', async () => {
    mockSynth.mockResolvedValue(successResult())
    const { getByTestId } = render(<TestComponent text="Hello world." />)
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    expect(lastTTSRef.current?.state.kind).toBe('paused')
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    expect(lastTTSRef.current?.state.kind).toBe('playing')
  })

  it('error path surfaces message', async () => {
    mockSynth.mockResolvedValue({ success: false, error: 'TTS failed' })
    const { getByTestId } = render(<TestComponent text="Hello world." />)
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(lastTTSRef.current?.state.kind).toBe('error')
    if (lastTTSRef.current?.state.kind === 'error') {
      expect(lastTTSRef.current.state.message).toBe('TTS failed')
    }
  })

  it('ENDED event without prefetched next → buffering', async () => {
    const text = Array.from({ length: 200 }, (_, i) => `Sentence number ${i} for the article body with some additional content to make it longer.`).join(' ')
    mockSynth.mockResolvedValue(successResult())
    const { getByTestId } = render(<TestComponent text={text} />)
    const audio = getByTestId('audio') as HTMLAudioElement
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(lastTTSRef.current?.state.kind).toBe('playing')
    act(() => {
      audio.dispatchEvent(new Event('ended'))
    })
    expect(lastTTSRef.current?.state.kind).toBe('buffering')
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('cleanup aborts in-flight requests and revokes URLs', async () => {
    let resolveFn: (v: { success: true; blob: Blob; mimeType: string; cached: boolean }) => void = () => {}
    const pending = new Promise<{ success: true; blob: Blob; mimeType: string; cached: boolean }>(resolve => {
      resolveFn = resolve
    })
    mockSynth.mockReturnValue(pending)
    const { getByTestId, unmount } = render(<TestComponent text="Hello world." />)
    act(() => {
      fireEvent.click(getByTestId('toggle'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(lastTTSRef.current?.state.kind).toBe('loading')
    unmount()
    resolveFn(successResult())
    await act(async () => {
      await Promise.resolve()
    })
  })
})
