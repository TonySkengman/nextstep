import { useLanguage } from './language'
import type { Interview } from './model'

export const emptyInterview: Interview = { date: '', time: '', location: '', notes: '' }

export function InterviewFields({ interview, onChange, requireDate = false }: {
  interview: Interview
  onChange: (interview: Interview) => void
  requireDate?: boolean
}) {
  const { t } = useLanguage()
  return <div className="form-grid">
    <label>{t('Interview date')}<input type="date" min="1900-01-01" max="9999-12-31" required={requireDate || Boolean(interview.time || interview.location.trim() || interview.notes.trim())} value={interview.date} onChange={event => onChange({ ...interview, date: event.target.value })} /></label>
    <label>{t('Time')}<input type="time" value={interview.time} onChange={event => onChange({ ...interview, time: event.target.value })} /></label>
    <label>{t('Location or meeting link')}<textarea rows={3} maxLength={1000} value={interview.location} onChange={event => onChange({ ...interview, location: event.target.value })} /></label>
    <label>{t('Interview notes')}<textarea rows={3} maxLength={8000} value={interview.notes} onChange={event => onChange({ ...interview, notes: event.target.value })} /></label>
  </div>
}

export function scheduledInterview(interview: Interview): Interview | undefined {
  if (!interview.date) return undefined
  return { ...interview, location: interview.location.trim(), notes: interview.notes.trim() }
}
