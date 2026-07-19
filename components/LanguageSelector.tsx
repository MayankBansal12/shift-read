'use client'

import { useState, useMemo } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { TranslateIcon } from '@hugeicons/core-free-icons'
import { SUPPORTED_LANGUAGES, REGIONS, getLanguageByCode, type Language } from '@/lib/languages'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Combobox,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxTrigger,
  ComboboxEmpty,
  ComboboxSeparator,
} from '@/components/ui/combobox'

interface LanguageSelectorProps {
  sourceLanguage?: string
  selectedLanguage?: string | null
  onLanguageChange: (language: string | null) => void
  disabled?: boolean
}

const ORIGINAL_VALUE = '__original__'

export default function LanguageSelector({
  sourceLanguage,
  selectedLanguage: selectedLanguageProp,
  onLanguageChange,
  disabled = false
}: LanguageSelectorProps) {
  const [value, setValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const handleValueChange = (newValue: string | null) => {
    const v = newValue || ''
    setValue(v)
    if (v === ORIGINAL_VALUE || !v) {
      onLanguageChange(null)
    } else {
      onLanguageChange(v)
    }
  }

  const availableLanguages = useMemo(
    () => SUPPORTED_LANGUAGES.filter(lang => lang.code !== sourceLanguage),
    [sourceLanguage]
  )

  const languagesByRegion = useMemo(
    () =>
      REGIONS.reduce((acc, region) => {
        const langs = availableLanguages.filter(lang => lang.region === region)
        if (langs.length > 0) acc[region] = langs
        return acc
      }, {} as Record<string, Language[]>),
    [availableLanguages]
  )

  const filteredLanguages = useMemo(() => {
    if (!searchQuery) return null
    const q = searchQuery?.toLowerCase()
    return availableLanguages?.filter(
      lang =>
        lang.name?.toLowerCase()?.includes(q) ||
        lang.nativeName?.toLowerCase()?.includes(q) ||
        lang.code?.toLowerCase()?.includes(q)
    )
  }, [searchQuery, availableLanguages])

  const sourceLangName = sourceLanguage ? getLanguageByCode(sourceLanguage)?.name?.toLowerCase() : null
  const originalLabel = sourceLangName ? `${sourceLangName} (original)` : 'original'

  const displayText = selectedLanguageProp
    ? (getLanguageByCode(selectedLanguageProp)?.name || 'translate')
    : 'translate'

  return (
    <Combobox value={value} onValueChange={handleValueChange}>
      <ComboboxTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}
        disabled={disabled}
      >
        <HugeiconsIcon icon={TranslateIcon} className="size-4" />
        <span className="text-lowercase">{displayText?.toLowerCase()}</span>
      </ComboboxTrigger>

      <ComboboxContent className="min-w-72 py-2 px-1">
        <div className="p-1">
          <Input
            type="text"
            placeholder="search languages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            disabled={disabled}
          />
        </div>
        <ComboboxList>
          {searchQuery ? (
            filteredLanguages && filteredLanguages.length > 0 ? (
              <>
                <ComboboxItem value={ORIGINAL_VALUE} className="font-medium my-1">
                  <span>{originalLabel?.toLowerCase()}</span>
                </ComboboxItem>
                {filteredLanguages.map(lang => (
                  <ComboboxItem key={lang.code} value={lang.code}>
                    <span className="font-medium">{lang.nativeName?.toLowerCase()}</span>
                    <span className="text-muted-foreground">({lang.name?.toLowerCase()})</span>
                  </ComboboxItem>
                ))}
              </>
            ) : (
              <ComboboxEmpty>no languages found</ComboboxEmpty>
            )
          ) : (
            <>
              <ComboboxItem value={ORIGINAL_VALUE} className="font-medium my-1">
                <span>{originalLabel?.toLowerCase()}</span>
              </ComboboxItem>
              <ComboboxSeparator />
              {Object.entries(languagesByRegion)?.map(([region, langs]) => (
                <ComboboxGroup key={region}>
                  <ComboboxLabel>{region?.toLowerCase()}</ComboboxLabel>
                  {langs.map(lang => (
                    <ComboboxItem key={lang.code} value={lang.code}>
                      <span className="font-medium">{lang.nativeName?.toLowerCase()}</span>
                      <span className="text-muted-foreground">({lang.name?.toLowerCase()})</span>
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              ))}
            </>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
