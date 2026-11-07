import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, Check, History, X } from 'lucide-react'
import { addDays, followUpDate, formatDay, methods, statuses } from './model'
import type { Application, Details } from './model'

type Props = {
  saveError?: string
  busy?: boolean
  initial: Details
  item?: Application
  onClose: () => void
  onSave: (details: Details) => void
  onComplete: (item: Application) => void
  onDelete: (item: Application) => void
}

export function ApplicationDialog({ saveError, busy, initial, item, onClose, onSave, onComplete, onDelete }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [details, setDetails] = useState<Details>(initial)
  const [mode, setMode] = useState(initial.followUp?.mode ?? 'none')
  const [date, setDate] = useState(initial.followUp?.mode === 'date' ? initial.followUp.date : '')
  const [days, setDays] = useState(initial.followUp?.mode === 'interval' ? String(initial.followUp.days) : '7')
  const [error, setError] = useState('')
  const savedDue = item && followUpDate(item)
  const hasEdits = JSON.stringify(details) !== JSON.stringify(initial) || mode !== (initial.followUp?.mode ?? 'none')
    || (mode === 'date' && date !== (initial.followUp?.mode === 'date' ? initial.followUp.date : ''))
    || (mode === 'interval' && days !== String(initial.followUp?.mode === 'interval' ? initial.followUp.days : 7))

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  function update<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails(previous => ({ ...previous, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!details.company.trim() || !details.position.trim()) {
      setError('Enter a company and position.')
      return
    }
    if (mode === 'interval' && !details.contactDate) {
      setError('Enter an application or contact date to use a follow-up interval.')
      return
    }

    if (mode === 'interval' && addDays(details.contactDate, Number(days)).length !== 10) {
      setError('Choose a shorter interval or an earlier contact date.')
      return
    }
    const followUp = mode === 'date' ? { mode, date } as const
      : mode === 'interval' ? { mode, days: Number(days) } as const
      : null
    onSave({ ...details, company: details.company.trim(), position: details.position.trim(), followUp })
  }

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose() }} aria-labelledby="dialog-title">
      <form onSubmit={submit}>
        <header className="dialog-header">
          <div>
            <p className="eyebrow">{item ? 'APPLICATION DETAILS' : 'NEW OPPORTUNITY'}</p>
            <h2 id="dialog-title">{item ? item.company : 'Add application'}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="dialog-body">
          <div className="form-grid">
            <label>Company<input required maxLength={100} value={details.company} onChange={e => update('company', e.target.value)} placeholder="e.g. Spotify" /></label>
            <label>Position<input required maxLength={120} value={details.position} onChange={e => update('position', e.target.value)} placeholder="e.g. Frontend Developer Intern" /></label>
            <label>Opportunity type<select value={details.kind} onChange={e => update('kind', e.target.value as Details['kind'])}><option>Job</option><option>Internship</option></select></label>
            <label>Recruitment status<select value={details.status} onChange={e => update('status', e.target.value as Details['status'])}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
            <label>Application or contact date<input type="date" required={mode === 'interval'} min="1900-01-01" max="9998-12-31" value={details.contactDate} onChange={e => update('contactDate', e.target.value)} /></label>
            <label>Contact method<select value={details.method} onChange={e => update('method', e.target.value as Details['method'])}><option value="">Select a method</option>{methods.map(method => <option key={method}>{method}</option>)}</select></label>
          </div>
          <label>Notes<textarea rows={3} maxLength={8000} value={details.notes} onChange={e => update('notes', e.target.value)} placeholder="Contact details, next steps, or anything to remember…" /></label>
          <section className="follow-settings" aria-labelledby="follow-title">
            <h3 id="follow-title"><CalendarClock size={17} /> Follow-up</h3>
            {savedDue && <div className="saved-reminder"><span>Scheduled for {formatDay(savedDue)}</span><button type="button" className="secondary" disabled={hasEdits || busy} title={hasEdits ? "Save your changes first" : undefined} onClick={() => item && onComplete(item)}><Check size={15} /> Mark done</button></div>}
            <div className="form-grid">
              <label>Reminder<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="none">No reminder</option><option value="date">On a specific date</option><option value="interval">Days after contact</option></select></label>
              {mode === 'date' && <label>Follow-up date<input type="date" required min="1900-01-01" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)} /></label>}
              {mode === 'interval' && <label>Days after contact<input type="number" required min="0" max="3650" step="1" value={days} onChange={e => setDays(e.target.value)} /></label>}
            </div>
          </section>
          {item && <section className="history" aria-labelledby="history-title">
            <h3 id="history-title"><History size={17} /> Application history</h3>
            <ol>{item.history.map(event => <li key={event.id}><span>{event.description}</span><time dateTime={event.time}>{new Date(event.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></li>)}</ol>
          </section>}
          {(saveError || error) && <p role="alert" className="error">{saveError || error}</p>}
        </div>
        <footer className="dialog-footer">
          {item && <button type="button" className="secondary delete-application" disabled={busy} onClick={() => {
            if (window.confirm(`Delete ${item.position} at ${item.company}? This also removes its reminder and history.`)) {
              onDelete(item)
            }
          }}>Delete application</button>}
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{item ? 'Save changes' : 'Add application'}</button>
        </footer>
      </form>
    </dialog>
  )
}
