'use client'

interface VolumeSliderProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

export default function VolumeSlider({ value, onChange, className }: VolumeSliderProps) {
  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height
    const newValue = Math.max(0, Math.min(1, 1 - y / height))
    onChange(newValue)
  }

  return (
    <div className={className}>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-label="Volume"
        tabIndex={0}
        onClick={handleBarClick}
        className="relative w-1.5 h-20 rounded-full bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(e) => {
          const step = 0.05
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            onChange(Math.min(1, value + step))
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            onChange(Math.max(0, value - step))
          }
        }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full bg-primary transition-all duration-75"
          style={{ height: `${value * 100}%` }}
        />
      </div>
    </div>
  )
}
