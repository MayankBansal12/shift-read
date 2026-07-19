'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertCircleIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import VolumeSlider from '@/components/ui/volume-slider'
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
  disabledMessage?: string
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
  chars,
  readingMinutes,
  volume,
  disabled = false,
  disabledMessage,
  onToggle,
  onVolumeChange,
  onMuteToggle,
}: ListenToArticleProps) {
  const isPlayingOrBuffering = state.kind === 'playing' || state.kind === 'buffering'
  const isLoading = state.kind === 'loading' && state.chunkIdx === 0
  const isPaused = state.kind === 'paused'
  const isError = state.kind === 'error'
  const isActive = isPlayingOrBuffering || isPaused

  let transportIcon = PlayIcon
  if (isPlayingOrBuffering || isLoading) transportIcon = PauseIcon
  else if (isPaused) transportIcon = PlayIcon

  const transportDisabled =
    disabled || tooLong || empty || isLoading || state.kind === 'buffering'

  const buttonText = isError
    ? 'Retry'
    : isLoading
      ? 'Loading…'
      : state.kind === 'buffering'
        ? 'Buffering…'
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
    hideTimerRef.current = setTimeout(() => setVolumeOpen(false), 1500)
  }

  const showVolume = () => {
    clearHideTimer()
    setVolumeOpen(true)
  }

  useEffect(() => () => clearHideTimer(), [])

  return (
    <section
      aria-label="Listen to this article"
      className="not-prose mb-8 rounded-lg border border-border py-2 px-3 text-sm text-muted-foreground"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 w-full">
        <span>
          <strong className="text-foreground">{words.toLocaleString()}</strong> words
        </span>
        <span aria-hidden className="font-bold">·</span>
        <span>
          <strong className="text-foreground">{chars.toLocaleString()}</strong> chars
        </span>
        <span aria-hidden className="font-bold">·</span>
        <span>
          ~<strong className="text-foreground">{readingMinutes}</strong> min read
        </span>
        {tooLong && (
          <span className="text-destructive">Article is too long to listen to in one session.</span>
        )}
        {empty && !tooLong && (
          <span>Nothing to read aloud.</span>
        )}

        {disabledMessage ? (
          <Tooltip>
            <TooltipTrigger className="ml-auto">
              <span tabIndex={0}>
                <Button
                  variant={isPlayingOrBuffering || isLoading ? 'secondary' : 'default'}
                  size="lg"
                  disabled
                  aria-label={buttonAriaLabel(state)}
                >
                  <HugeiconsIcon icon={transportIcon} className="size-5" />
                  <span>{buttonText}</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{disabledMessage}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant={isPlayingOrBuffering || isLoading ? 'secondary' : 'default'}
            size="lg"
            onClick={onToggle}
            disabled={transportDisabled}
            aria-label={buttonAriaLabel(state)}
            className="ml-auto"
          >
            <HugeiconsIcon icon={transportIcon} className="size-5" />
            <span>{buttonText}</span>
          </Button>
        )}

        {isActive && (
          <div
            className="relative flex items-center"
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-20 animate-in fade-in slide-in-from-bottom-1 duration-150">
                <VolumeSlider
                  value={volume}
                  onChange={onVolumeChange}
                  className="rounded-lg border border-border bg-popover/85 backdrop-blur-sm p-2 shadow-md"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {isError && (
        <div className="w-full flex items-center justify-center gap-2 rounded-lg bg-destructive/10 text-destructive px-4 py-2 mt-2">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      <audio ref={audioRef} hidden preload="none" />
    </section>
  )
}
