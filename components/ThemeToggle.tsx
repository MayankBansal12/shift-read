'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun01Icon, Moon01Icon } from '@hugeicons/core-free-icons'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return getSystemTheme()
}

function applyTheme(theme: 'dark' | 'light') {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

function persistTheme(theme: 'dark' | 'light') {
  try {
    localStorage.setItem('theme', theme)
  } catch {}
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const theme = getStoredTheme()
    applyTheme(theme)
    setIsDark(theme === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    applyTheme(next)
    persistTheme(next)
    setIsDark(!isDark)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <HugeiconsIcon
        icon={isDark ? Sun01Icon : Moon01Icon}
        className="size-5"
      />
    </Button>
  )
}
