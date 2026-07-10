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
  chars,
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

  const chunkPosition =
    state.kind === 'playing' || state.kind === 'paused' || state.kind === 'buffering'
      ? state.chunkIdx + 1
      : null

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
            : state.kind === 'ended'
              ? 'Listen again'
              : 'Listen to this article'

  const VolIcon = volumeIcon(volume)

  return (
    <section
      aria-label="Listen to this article"
      className="not-prose mb-8 flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{words.toLocaleString()}</strong> words
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong className="text-foreground">{chars.toLocaleString()}</strong> chars
        </span>
        <span aria-hidden>·</span>
        <span>~{readingMinutes} min read</span>
        {chunks.length > 0 && !tooLong && (
          <span aria-hidden>·</span>
        )}
        {chunks.length > 0 && !tooLong && (
          <span>~{chunks.length} listen chunk{chunks.length === 1 ? '' : 's'}</span>
        )}
        {tooLong && (
          <span className="text-destructive">Article is too long to listen to in one session.</span>
        )}
        {empty && !tooLong && (
          <span className="text-muted-foreground">Nothing to read aloud.</span>
        )}
        {isError && (
          <span className="text-destructive">· {state.message}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={isPlayingOrBuffering || isLoading ? 'secondary' : 'default'}
          size="lg"
          onClick={onToggle}
          disabled={transportDisabled}
          aria-label={buttonAriaLabel(state)}
        >
          {isAnimating ? (
            <SpeakingAnimation />
          ) : (
            <HugeiconsIcon icon={transportIcon} className="size-5" />
          )}
          <span className="ml-2">{buttonText}</span>
        </Button>

        <button
          onClick={onMuteToggle}
          aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          className="p-2 rounded-md hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={VolIcon} className="size-5" />
        </button>

        <VolumeSlider value={volume} onChange={onVolumeChange} />

        {chunkPosition !== null && chunks.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {chunkPosition}/{chunks.length}
          </span>
        )}
      </div>

      <audio ref={audioRef} hidden preload="none" />
    </section>
  )
}
