'use client'

import { cn } from '@/lib/utils'

interface VolumeSliderProps {
  value: number
  onChange: (value: number) => void
  className?: string
  ariaLabel?: string
}

export default function VolumeSlider({
  value,
  onChange,
  className,
  ariaLabel = 'Volume',
}: VolumeSliderProps) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      aria-label={ariaLabel}
      className={cn(
        'w-28 accent-primary cursor-pointer appearance-none bg-transparent',
        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:border-none',
        '[&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:border-none',
        className
      )}
    />
  )
}
