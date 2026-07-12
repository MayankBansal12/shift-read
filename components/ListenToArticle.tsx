'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import VolumeSlider from '@/components/ui/volume-slider'
import SpeakingAnimation from '@/components/SpeakingAnimation'
import type { TTSState } from '@/hooks/useArticleTTS'
import { useEffect, useRef, useState } from 'react'

interface ListenToArticleProps {
  state: TTSState
  audioRef: React.RefObject<HTMLAudioElement | null>
  chunks: string[]
  tooLong: boolean
  empty: boolean
  words: number
  chars: number
  readingMinutes: number
  volume: number
  disabled?: boolean
  onToggle: () => void
  onVolumeChange: (v: number) => void
  onMuteToggle: () => void
}

function buttonAriaLabel(state: TTSState): string {
  if (state.kind === 'playing' || state.kind === 'buffering') return 'Pause listening to article'
  if (state.kind === 'paused') return 'Resume listening to article'
  if (state.kind === 'loading') return 'Loading article audio'
  if (state.kind === 'error') return 'Retry loading article audio'
  return 'Listen to this article'
}

function volumeIcon(volume: number) {
  if (volume === 0) return VolumeMuteIcon
  if (volume < 0.5) return VolumeLowIcon
  return VolumeHighIcon
}

export default function ListenToArticle({
  state,
  audioRef,
  chunks,
  tooLong,
  empty,
  words,
  readingMinutes,
  volume,
  disabled = false,
  onToggle,
  onVolumeChange,
  onMuteToggle,
}: ListenToArticleProps) {
  const isAnimating = state.kind === 'playing' || state.kind === 'buffering'
  const isPlayingOrBuffering = isAnimating
  const isLoading = state.kind === 'loading' && state.chunkIdx === 0
  const isPaused = state.kind === 'paused'
  const isError = state.kind === 'error'

  let transportIcon = PlayIcon
  if (isPlayingOrBuffering || isLoading) transportIcon = PauseIcon
  else if (isPaused) transportIcon = PlayIcon

  const transportDisabled =
    disabled || tooLong || empty || isLoading || state.kind === 'buffering'

  const buttonText = isError
    ? 'Retry'
    : isLoading
      ? 'Loading…'
      : isPlayingOrBuffering
        ? 'Pause'
        : isPaused
          ? 'Resume'
          : chunks.length === 0
            ? 'Nothing to read aloud'
            : 'Listen'

  const VolIcon = volumeIcon(volume)

  const [volumeOpen, setVolumeOpen] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const scheduleHide = () => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setVolumeOpen(false), 3000)
  }

  const showVolume = () => {
    clearHideTimer()
    setVolumeOpen(true)
  }

  useEffect(() => () => clearHideTimer(), [])

  return (
    <section
      aria-label="Listen to this article"
      className="not-prose mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border p-4 text-sm text-muted-foreground"
    >
      <span>
        <strong className="text-foreground">{words.toLocaleString()}</strong> words
      </span>
      <span aria-hidden>·</span>
      <span>
        ~<strong className="text-foreground">{readingMinutes}</strong> min read
      </span>
      {tooLong && (
        <span className="text-destructive">Article is too long to listen to in one session.</span>
      )}
      {empty && !tooLong && (
        <span>Nothing to read aloud.</span>
      )}
      {isError && (
        <span className="text-destructive">· {state.message}</span>
      )}

      <Button
        variant={isPlayingOrBuffering || isLoading ? 'secondary' : 'default'}
        size="lg"
        onClick={onToggle}
        disabled={transportDisabled}
        aria-label={buttonAriaLabel(state)}
        className="ml-auto"
      >
        {isAnimating ? (
          <SpeakingAnimation />
        ) : (
          <HugeiconsIcon icon={transportIcon} className="size-5" />
        )}
        <span>{buttonText}</span>
      </Button>

      <div
        className="flex items-center gap-2"
        onMouseEnter={showVolume}
        onMouseLeave={scheduleHide}
      >
        <button
          onClick={() => {
            onMuteToggle()
            setVolumeOpen(v => !v)
            scheduleHide()
          }}
          aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          className="p-2 rounded-md hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={VolIcon} className="size-5" />
        </button>

        {volumeOpen && (
          <VolumeSlider value={volume} onChange={onVolumeChange} />
        )}
      </div>

      <audio ref={audioRef} hidden preload="none" />
    </section>
  )
}
