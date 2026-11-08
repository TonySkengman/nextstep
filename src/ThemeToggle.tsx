import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from './language'

export function ThemeToggle() {
  const { t } = useLanguage()
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const action = t(dark ? 'Switch to light mode' : 'Switch to dark mode')

  function toggleTheme() {
    const theme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    setDark(!dark)
    try {
      localStorage.setItem('nextstep:theme', theme)
    } catch {
      // Keep the selected theme for this session if storage is unavailable.
    }
  }

  return <button type="button" className="secondary theme-toggle" aria-label={action} title={action} onClick={toggleTheme}>
    {dark ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
    <span>{t(dark ? 'Dark' : 'Light')}</span>
  </button>
}
