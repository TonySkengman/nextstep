import type { Interview } from './model'

export const emptyInterview: Interview = { date: '', time: '', location: '', notes: '' }

export function InterviewFields({ interview, onChange }: {
  interview: Interview
  onChange: (interview: Interview) => void
}) {
  return <div className="form-grid">
    <label>Interview date<input type="date" min="1900-01-01" max="9999-12-31" required={Boolean(interview.time || interview.location.trim() || interview.notes.trim())} value={interview.date} onChange={event => onChange({ ...interview, date: event.target.value })} /></label>
    <label>Time<input type="time" value={interview.time} onChange={event => onChange({ ...interview, time: event.target.value })} /></label>
    <label>Location or meeting link<textarea rows={3} maxLength={1000} value={interview.location} onChange={event => onChange({ ...interview, location: event.target.value })} /></label>
    <label>Interview notes<textarea rows={3} maxLength={8000} value={interview.notes} onChange={event => onChange({ ...interview, notes: event.target.value })} /></label>
  </div>
}

export function scheduledInterview(interview: Interview): Interview | undefined {
  if (!interview.date) return undefined
  return { ...interview, location: interview.location.trim(), notes: interview.notes.trim() }
}
