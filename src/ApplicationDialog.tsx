import { useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, Check, ExternalLink, History, Mail, Phone, X } from 'lucide-react'
import { InterviewFields, emptyInterview, scheduledInterview } from './InterviewFields'
import { Modal } from './Modal'
import { OutcomeBadge } from './OutcomeBadge'
import { addDays, followUpCount, followUpDate, formatDay, localDay, methods, outcomes } from './model'
import type { Application, Details } from './model'

function webLink(value?: string) {
  if (!value) return undefined
  try {
    const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    const url = new URL(hasScheme ? value : `https://${value}`)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
  } catch {
    return undefined
  }
}

type Props = {
  saveError?: string
  busy?: boolean
  initial: Details
  item?: Application
  onClose: () => void
  onSave: (details: Details) => void
  onComplete: (item: Application, nextDate?: string) => void
  onDelete: (item: Application) => void
}

export function ApplicationDialog({ saveError, busy, initial, item, onClose, onSave, onComplete, onDelete }: Props) {
  const registeringInterest = !item && initial.status === 'Interested'
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [details, setDetails] = useState<Details>(initial)
  const [mode, setMode] = useState(initial.followUp?.mode ?? 'none')
  const [date, setDate] = useState(initial.followUp?.mode === 'date' ? initial.followUp.date : '')
  const [days, setDays] = useState(initial.followUp?.mode === 'interval' ? String(initial.followUp.days) : '7')
  const [error, setError] = useState('')
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string | null>(null)
  const savedDue = item && followUpDate(item)
  const followedUp = item ? followUpCount(item) : 0
  const interview = details.interview && (initial.status === 'Interview' || details.interview !== initial.interview)
    ? details.interview : emptyInterview
  const postingLink = webLink(item?.postingUrl)
  const linkedInLink = webLink(item?.recruiterLinkedIn)
  const emailLink = item?.recruiterEmail && `mailto:${encodeURIComponent(item.recruiterEmail).replace('%40', '@')}`
  const phoneNumber = item?.recruiterPhone?.replace(/[\s().-]/g, '') ?? ''
  const phoneLink = /^\+?\d+$/.test(phoneNumber) ? `tel:${phoneNumber}` : undefined
  const hasEdits = JSON.stringify(details) !== JSON.stringify(item ?? initial) || mode !== (initial.followUp?.mode ?? 'none')
    || (mode === 'date' && date !== (initial.followUp?.mode === 'date' ? initial.followUp.date : ''))
    || (mode === 'interval' && days !== String(initial.followUp?.mode === 'interval' ? initial.followUp.days : 7))
  const history = item && <section className="history" aria-labelledby="history-title">
    <h3 id="history-title"><History size={17} /> Application history</h3>
    <ol>{item.history.map(event => <li key={event.id}><span>{event.description}</span><time dateTime={event.time}>{new Date(event.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></li>)}</ol>
  </section>
  const reminder = item && (item.status !== 'Completed' || savedDue || followedUp > 0) && <section className="follow-settings" aria-labelledby="saved-follow-title">
    <h3 id="saved-follow-title"><CalendarClock size={17} /> Follow-up</h3>
    <div className="saved-reminder-info">
      <div>{savedDue ? `Scheduled for ${formatDay(savedDue)}` : 'No reminder scheduled'}</div>
      {followedUp > 0 && <div>Followed up {followedUp} {followedUp === 1 ? 'time' : 'times'}</div>}
    </div>
    {nextFollowUpDate === null ? (savedDue || item.status !== 'Completed') &&
      <div className="follow-up-actions">
        {savedDue && <button type="button" className="secondary" disabled={busy} onClick={() => onComplete(item)}><Check size={15} /> Mark done</button>}
        {item.status !== 'Completed' && <button type="button" className="secondary" disabled={busy} onClick={() => setNextFollowUpDate(addDays(localDay(), 7))}>
          {savedDue || followedUp > 0 ? 'Schedule another follow-up' : 'Schedule a follow-up'}
        </button>}
      </div> : <form className="next-follow-up" onSubmit={event => {
        event.preventDefault()
        onComplete(item, nextFollowUpDate)
      }}>
        {savedDue && <p>This will mark the current follow-up as done and schedule the next one.</p>}
        <label>Next follow-up date<input type="date" required min={localDay()} max="9999-12-31" value={nextFollowUpDate} onChange={event => setNextFollowUpDate(event.target.value)} /></label>
        <div className="follow-up-actions">
          <button type="button" className="secondary" onClick={() => setNextFollowUpDate(null)}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>Schedule</button>
        </div>
      </form>}
  </section>

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
    const postingInput = details.postingUrl?.trim()
    const linkedInInput = details.recruiterLinkedIn?.trim()
    const postingUrl = webLink(postingInput)
    const recruiterLinkedIn = webLink(linkedInInput)
    if ((postingInput && !postingUrl) || (linkedInInput && !recruiterLinkedIn)) {
      setError('Enter a valid job posting or LinkedIn URL.')
      return
    }
    const followUp = mode === 'date' ? { mode, date } as const
      : mode === 'interval' ? { mode, days: Number(days) } as const
      : null
    onSave({ ...details, company: details.company.trim(), position: details.position.trim(), followUp,
      location: details.location?.trim() || undefined,
      applicationDeadline: details.applicationDeadline || undefined,
      postingUrl, recruiterLinkedIn,
      recruiterName: details.recruiterName?.trim() || undefined,
      recruiterPhone: details.recruiterPhone?.trim() || undefined,
      recruiterEmail: details.recruiterEmail?.trim() || undefined,
      interview: scheduledInterview(interview),
    })
  }

  return <>
    <Modal titleId="dialog-title" onClose={onClose}>
      {item && !editing ? <div className="application-view">
        <header className="dialog-header">
          <div>
            <p className="eyebrow">APPLICATION DETAILS</p>
            <h2 id="dialog-title">{item.company}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="dialog-body">
          <dl className="form-grid">
            <div><dt>Position</dt><dd>{item.position}</dd></div>
            {item.location && <div><dt>Location</dt><dd>{item.location}</dd></div>}
            <div><dt>Opportunity type</dt><dd>{item.kind}</dd></div>
            {item.applicationDeadline && <div className="full-width-field"><dt>Application deadline</dt><dd>{formatDay(item.applicationDeadline)}</dd></div>}
            {item.outcome && <div><dt>Outcome</dt><dd><OutcomeBadge outcome={item.outcome} /></dd></div>}
            {item.contactDate && <div><dt>Application or contact date</dt><dd>{formatDay(item.contactDate)}</dd></div>}
            {item.method && <div><dt>Contact method</dt><dd>{item.method}</dd></div>}
          </dl>
          {(postingLink || linkedInLink || item.recruiterName || item.recruiterEmail || item.recruiterPhone) && <section className="follow-settings" aria-labelledby="saved-recruiter-title">
            <h3 id="saved-recruiter-title">Posting and recruiter</h3>
            <div className="recruiter-details">
              {postingLink && <dl><dt>Job posting link <a className="icon-button" href={postingLink} target="_blank" rel="noopener noreferrer" aria-label="Open posting"><ExternalLink size={14} /></a></dt><dd>{item.postingUrl}</dd></dl>}
              {(item.recruiterName || linkedInLink) && <dl className="form-grid">
                {item.recruiterName && <div><dt>Recruiter name</dt><dd>{item.recruiterName}</dd></div>}
                {linkedInLink && <div className="recruiter-details-right"><dt>Recruiter LinkedIn URL <a className="icon-button" href={linkedInLink} target="_blank" rel="noopener noreferrer" aria-label="Open LinkedIn"><ExternalLink size={14} /></a></dt><dd>{item.recruiterLinkedIn}</dd></div>}
              </dl>}
              {(item.recruiterEmail || item.recruiterPhone) && <dl className="form-grid">
                {item.recruiterEmail && <div><dt>Recruiter email {emailLink && <a className="icon-button" href={emailLink} aria-label="Email contact"><Mail size={14} /></a>}</dt><dd>{item.recruiterEmail}</dd></div>}
                {item.recruiterPhone && <div className="recruiter-details-right"><dt>Recruiter phone number {phoneLink && <a className="icon-button" href={phoneLink} aria-label="Call phone"><Phone size={14} /></a>}</dt><dd>{item.recruiterPhone}</dd></div>}
              </dl>}
            </div>
          </section>}
          {reminder}
          {item.status === 'Interview' && item.interview && <section className="follow-settings" aria-labelledby="saved-interview-title">
            <h3 id="saved-interview-title"><CalendarClock size={17} /> Interview details</h3>
            <dl className="form-grid">
              <div><dt>Interview date</dt><dd>{formatDay(item.interview.date)}</dd></div>
              {item.interview.time && <div><dt>Time</dt><dd>{item.interview.time}</dd></div>}
              {item.interview.location && <div><dt>Location or meeting link</dt><dd>{item.interview.location}</dd></div>}
              {item.interview.notes && <div><dt>Interview notes</dt><dd>{item.interview.notes}</dd></div>}
            </dl>
          </section>}
          {item.notes && <dl><dt>Notes</dt><dd>{item.notes}</dd></dl>}
          {history}
          {saveError && <p role="alert" className="error">{saveError}</p>}
        </div>
        <footer className="dialog-footer">
          <button type="button" className="secondary" onClick={onClose}>Close</button>
          <button type="button" className="primary" onClick={() => setEditing(true)}>Edit</button>
        </footer>
      </div> : <form onSubmit={submit}>
        <header className="dialog-header">
          <div>
            <p className="eyebrow">{item ? 'EDIT APPLICATION' : 'NEW OPPORTUNITY'}</p>
            <h2 id="dialog-title">{item ? item.company : registeringInterest ? 'Save an opportunity' : 'Add application'}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="dialog-body">
          <div className="form-grid">
            <label>Company<input required maxLength={100} value={details.company} onChange={e => update('company', e.target.value)} placeholder="e.g. Spotify" /></label>
            <label>Location (optional)<input maxLength={120} value={details.location ?? ''} onChange={e => update('location', e.target.value)} placeholder="e.g. Stockholm / Remote" /></label>
            <label>Position<input required maxLength={120} value={details.position} onChange={e => update('position', e.target.value)} placeholder="e.g. Frontend Developer Intern" /></label>
            <label>Opportunity type<select value={details.kind} onChange={e => update('kind', e.target.value as Details['kind'])}><option>Job</option><option>Internship</option></select></label>
            {(initial.status === 'Interested' || initial.applicationDeadline) && (
              <label className="full-width-field">Application deadline (optional)
                <input type="date" min="1900-01-01" max="9999-12-31" value={details.applicationDeadline ?? ''} onChange={e => update('applicationDeadline', e.target.value || undefined)} />
              </label>
            )}
            {!registeringInterest && <>
              <label>Application or contact date<input type="date" required={mode === 'interval'} min="1900-01-01" max="9998-12-31" value={details.contactDate} onChange={e => update('contactDate', e.target.value)} /></label>
              <label>Contact method<select value={details.method} onChange={e => update('method', e.target.value as Details['method'])}><option value="">Select a method</option>{methods.map(method => <option key={method}>{method}</option>)}</select></label>
              {details.status === 'Completed' && <label>Outcome<select value={details.outcome ?? ''} onChange={e => update('outcome', (e.target.value || undefined) as Details['outcome'])}><option value="">Select an outcome</option>{outcomes.map(outcome => <option key={outcome}>{outcome}</option>)}</select></label>}
            </>}
          </div>
          <section className="follow-settings" aria-labelledby="recruiter-title">
            <h3 id="recruiter-title">Posting and recruiter (optional)</h3>
            <div className="form-grid">
              <label className="full-width-field">Job posting link<input inputMode="url" maxLength={2000} value={details.postingUrl ?? ''} onChange={e => update('postingUrl', e.target.value)} placeholder="company.com/careers/role" /></label>
              <label>Recruiter name<input maxLength={120} value={details.recruiterName ?? ''} onChange={e => update('recruiterName', e.target.value)} placeholder="e.g. Alex Andersson" /></label>
              <label>Recruiter LinkedIn URL<input inputMode="url" maxLength={2000} value={details.recruiterLinkedIn ?? ''} onChange={e => update('recruiterLinkedIn', e.target.value)} placeholder="linkedin.com/in/…" /></label>
              <label>Recruiter email<input type="email" maxLength={254} value={details.recruiterEmail ?? ''} onChange={e => update('recruiterEmail', e.target.value)} placeholder="e.g. alex@company.com" /></label>
              <label>Recruiter phone number<input type="tel" maxLength={80} value={details.recruiterPhone ?? ''} onChange={e => update('recruiterPhone', e.target.value)} placeholder="e.g. +46 70 123 45 67" /></label>
            </div>
          </section>
          {!registeringInterest && <>
            <section className="follow-settings" aria-labelledby="follow-title">
              <h3 id="follow-title"><CalendarClock size={17} /> Follow-up</h3>
              {savedDue && <div className="saved-reminder"><span>Scheduled for {formatDay(savedDue)}</span><button type="button" className="secondary" disabled={hasEdits || busy} title={hasEdits ? "Save your changes first" : undefined} onClick={() => item && onComplete(item)}><Check size={15} /> Mark done</button></div>}
              <div className="form-grid">
                <label>Reminder
                  <select value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
                    <option value="none">No reminder</option>
                    <option value="date">On a specific date</option>
                    {item && <option value="interval">Days after contact</option>}
                  </select>
                </label>
                {mode === 'date' && <label>Follow-up date<input type="date" required min="1900-01-01" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)} /></label>}
                {mode === 'interval' && <label>Days after contact<input type="number" required min="0" max="3650" step="1" value={days} onChange={e => setDays(e.target.value)} /></label>}
              </div>
            </section>
            {details.status === 'Interview' && <section className="follow-settings" aria-labelledby="interview-title">
              <h3 id="interview-title"><CalendarClock size={17} /> Interview details</h3>
              <InterviewFields interview={interview} onChange={value => update('interview', value)} />
            </section>}
          </>}
          <label>Notes<textarea rows={3} maxLength={8000} value={details.notes} onChange={e => update('notes', e.target.value)} placeholder={registeringInterest ? 'Anything you want to remember about this opportunity…' : 'Contact details, next steps, or anything to remember…'} /></label>
          {history}
          {(saveError || error) && <p role="alert" className="error">{saveError || error}</p>}
        </div>
        <footer className="dialog-footer">
          {item && <button type="button" className="secondary delete-application" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete application</button>}
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{item ? 'Save changes' : registeringInterest ? 'Save opportunity' : 'Add application'}</button>
        </footer>
      </form>}
    </Modal>
    {item && confirmDelete && <Modal titleId="delete-title" onClose={() => setConfirmDelete(false)}>
      <header className="dialog-header"><h2 id="delete-title">Delete application?</h2></header>
      <div className="dialog-body">
        <p>Delete {item.position} at {item.company}? This also removes its reminder and history.</p>
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
        <button type="button" className="secondary delete-confirm" disabled={busy} onClick={() => {
          setConfirmDelete(false)
          onDelete(item)
        }}>Delete application</button>
      </footer>
    </Modal>}
  </>
}
