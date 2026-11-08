import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { formatDay } from './model'
import { swedish } from './swedish'

type Language = 'en' | 'sv'
type Translator = (message: string, values?: Record<string, string | number>) => string

const languageKey = 'nextstep:language'
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void } | null>(null)

function initialLanguage(): Language {
  try {
    return localStorage.getItem(languageKey) === 'sv' ? 'sv' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage)
  useEffect(() => {
    document.documentElement.lang = language
    document.title = language === 'sv' ? swedish['nextstep — Your next opportunity'] : 'nextstep — Your next opportunity'
    try {
      localStorage.setItem(languageKey, language)
    } catch {
      // The choice still applies for this visit.
    }
  }, [language])

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)!
  const locale = context.language === 'sv' ? 'sv-SE' : 'en'
  const t: Translator = (message, values) => {
    const template = context.language === 'sv' && Object.hasOwn(swedish, message) ? swedish[message] : message
    return values ? template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token) : template
  }
  return { ...context, locale, t, formatDay: (day: string) => formatDay(day, locale) }
}

export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage()
  return <select className="language-select" aria-label={t('Language')} value={language} onChange={event => setLanguage(event.target.value === 'sv' ? 'sv' : 'en')}>
    <option value="en" lang="en" label="English 🇬🇧">English</option>
    <option value="sv" lang="sv" label="Svenska 🇸🇪">Svenska</option>
  </select>
}

// Saved history uses English descriptions. Translate known events at display time.
export function translateHistory(description: string, t: Translator, locale: string) {
  if (locale === 'en') return description

  const added = /^Added to (.+)$/.exec(description)
  if (added) return t('Added to {column}', { column: t(added[1]) })

  const moved = /^Moved from (.+) to (.+)$/.exec(description)
  if (moved) return t('Moved from {from} to {to}', { from: t(moved[1]), to: t(moved[2]) })

  const outcome = /^Recorded outcome: (.+)$/.exec(description)
  if (outcome) return t('Recorded outcome: {outcome}', { outcome: t(outcome[1]) })

  const scheduled = /^(Scheduled interview for|Updated interview for|Scheduled follow-up for|Rescheduled follow-up for|Completed follow-up due) ([A-Za-z]{3} \d{1,2}, \d{4})$/.exec(description)
  if (scheduled) {
    const date = new Date(scheduled[2])
    if (!Number.isNaN(date.getTime())) {
      const formatted = date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
      return t(`${scheduled[1]} {date}`, { date: formatted })
    }
  }

  return t(description)
}
