import { translateHistory, useLanguage } from './language'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, Check, ExternalLink, History, Mail, Phone, X } from 'lucide-react'
import { InterviewFields, emptyInterview, scheduledInterview } from './InterviewFields'
import { Modal } from './Modal'
import { OutcomeBadge } from './OutcomeBadge'
import { addDays, boardColumn, followUpCount, followUpDate, localDay, methods, outcomes } from './model'
import type { Application, Details, Interview } from './model'

function InterviewSummary({ interview }: { interview: Interview }) {
  const { t, formatDay } = useLanguage()
  return <dl className="form-grid">
    <div><dt>{t('Interview date')}</dt><dd>{formatDay(interview.date)}</dd></div>
    {interview.time && <div><dt>{t('Time')}</dt><dd>{interview.time}</dd></div>}
    {interview.location && <div><dt>{t('Location or meeting link')}</dt><dd>{interview.location}</dd></div>}
    {interview.notes && <div className="full-width-field"><dt>{t('Interview notes')}</dt><dd>{interview.notes}</dd></div>}
  </dl>
}

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
  onMarkApplied: (item: Application) => void
  onFinishInterview: (item: Application) => void
  onComplete: (item: Application, nextDate?: string) => void
  onDuplicate: (item: Application) => void
  onDelete: (item: Application) => void
}

export function ApplicationDialog({ saveError, busy, initial, item, onClose, onSave, onMarkApplied, onFinishInterview, onComplete, onDuplicate, onDelete }: Props) {
  const { t, formatDay, locale } = useLanguage()
  const registeringInterest = !item && initial.status === 'Interested'
  const trackingOpportunity = !item && initial.status === 'In Contact'
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [details, setDetails] = useState<Details>(initial)
  const [mode, setMode] = useState(initial.followUp?.mode ?? 'none')
  const [date, setDate] = useState(initial.followUp?.mode === 'date' ? initial.followUp.date : '')
  const [days, setDays] = useState(initial.followUp?.mode === 'interval' ? String(initial.followUp.days) : '7')
  const [error, setError] = useState('')
  const [followUpForm, setFollowUpForm] = useState<{ action: 'schedule' | 'reschedule'; date: string } | null>(null)
  const today = localDay()
  const savedDue = item && followUpDate(item)
  const isFollowUpColumn = item && boardColumn(item, today) === 'Follow-up'
  const followedUp = item ? followUpCount(item) : 0
  const decisionNote = item?.decisionNote && <section className="follow-settings decision-note-section" aria-labelledby="saved-decision-note-title">
    <h3 id="saved-decision-note-title">{t('Decision note')}</h3>
    <p>{item.decisionNote}</p>
  </section>
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
    <h3 id="history-title"><History size={17} /> {t('Application history')}</h3>
    <ol>{item.history.map(event => <li key={event.id}><span>{translateHistory(event.description, t, locale)}</span><time dateTime={event.time}>{new Date(event.time).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time></li>)}</ol>
  </section>
  const reminder = item && (item.status !== 'Completed' || savedDue || followedUp > 0) && <section className="follow-settings" aria-labelledby="saved-follow-title">
    <h3 id="saved-follow-title"><CalendarClock size={17} /> {t('Follow-up')}</h3>
    <div className="saved-reminder-info">
      <div>{savedDue ? t('Scheduled for {date}', { date: formatDay(savedDue) }) : t('No reminder scheduled')}</div>
      {followedUp > 0 && <div>{t(followedUp === 1 ? 'Followed up {count} time' : 'Followed up {count} times', { count: followedUp })}</div>}
    </div>
    {followUpForm === null ? (savedDue || item.status !== 'Completed') &&
      <div className="follow-up-actions">
        {savedDue && <button type="button" className="secondary" disabled={busy} onClick={() => onComplete(item)}><Check size={15} /> {t('Mark done')}</button>}
        {savedDue && <button type="button" className="secondary" disabled={busy} onClick={() => setFollowUpForm({ action: 'reschedule', date: savedDue < today ? today : savedDue })}>
          {t('Reschedule')}
        </button>}
        {item.status !== 'Completed' && <button type="button" className="secondary" disabled={busy} onClick={() => setFollowUpForm({ action: 'schedule', date: addDays(today, 7) })}>
          {savedDue || followedUp > 0 ? t('Schedule another follow-up') : t('Schedule a follow-up')}
        </button>}
      </div> : <form className="next-follow-up" onSubmit={event => {
        event.preventDefault()
        if (followUpForm.action === 'reschedule') {
          onSave({ ...item, followUp: { mode: 'date', date: followUpForm.date } })
        } else {
          onComplete(item, followUpForm.date)
        }
      }}>
        {savedDue && followUpForm.action === 'schedule' && <p>{t('This will mark the current follow-up as done and schedule the next one.')}</p>}
        <label>{t(followUpForm.action === 'reschedule' ? 'Follow-up date' : 'Next follow-up date')}<input type="date" required min={today} max="9999-12-31" value={followUpForm.date} onChange={event => setFollowUpForm({ ...followUpForm, date: event.target.value })} /></label>
        <div className="follow-up-actions">
          <button type="button" className="secondary" onClick={() => setFollowUpForm(null)}>{t('Cancel')}</button>
          <button type="submit" className="primary" disabled={busy || (followUpForm.action === 'reschedule' && followUpForm.date === savedDue)}>{t(followUpForm.action === 'reschedule' ? 'Save changes' : 'Schedule')}</button>
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
      interview: details.status === 'Completed' && details.interviewDone ? details.interview : scheduledInterview(interview),
    })
  }

  return <>
    <Modal titleId="dialog-title" onClose={onClose}>
      {item && !editing ? <div className="application-view">
        <header className="dialog-header">
          <div>
            <p className="eyebrow">{t('APPLICATION DETAILS')}</p>
            <h2 id="dialog-title">{item.company}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={t('Close')} onClick={onClose}><X size={20} /></button>
        </header>
        <div className="dialog-body">
          {(item.status === 'Interview' || item.interviewDone) && <section className="follow-settings" aria-labelledby="saved-interview-title">
            <h3 id="saved-interview-title"><CalendarClock size={17} /> {t('Interview details')}</h3>
            {item.interviewDone && <p>{t('Interview marked as done.')}</p>}
            {item.interview ? <InterviewSummary interview={item.interview} /> : !item.interviewDone && <p>{t('No interview date scheduled yet.')}</p>}
          </section>}
          {item.status === 'Interview' && decisionNote}
          {Boolean(item.pastInterviews?.length) && <section className="follow-settings" aria-labelledby="past-interviews-title">
            <h3 id="past-interviews-title"><CalendarClock size={17} /> {t('Previous interviews')}</h3>
            <div className="past-interviews">
              {item.pastInterviews?.map((interview, index) => <InterviewSummary key={index} interview={interview} />)}
            </div>
          </section>}
          <dl className="form-grid">
            <div><dt>{t('Position')}</dt><dd>{item.position}</dd></div>
            {item.location && <div><dt>{t('Location')}</dt><dd>{item.location}</dd></div>}
            <div><dt>{t('Opportunity type')}</dt><dd>{t(item.kind)}</dd></div>
            {item.applicationDeadline && <div className="full-width-field"><dt>{t('Application deadline')}</dt><dd>{formatDay(item.applicationDeadline)}</dd></div>}
            {item.outcome && <div><dt>{t('Outcome')}</dt><dd><OutcomeBadge outcome={item.outcome} /></dd></div>}
            {item.contactDate && <div><dt>{t('Application or contact date')}</dt><dd>{formatDay(item.contactDate)}</dd></div>}
            {item.method && <div><dt>{t('Contact method')}</dt><dd>{t(item.method)}</dd></div>}
          </dl>
          {(postingLink || linkedInLink || item.recruiterName || item.recruiterEmail || item.recruiterPhone) && <section className="follow-settings" aria-labelledby="saved-recruiter-title">
            <h3 id="saved-recruiter-title">{t('Posting and recruiter')}</h3>
            <div className="recruiter-details">
              {postingLink && <dl><dt>{t('Job posting link')} <a className="icon-button" href={postingLink} target="_blank" rel="noopener noreferrer" aria-label={t('Open posting')}><ExternalLink size={14} /></a></dt><dd>{item.postingUrl}</dd></dl>}
              {(item.recruiterName || linkedInLink) && <dl className="form-grid">
                {item.recruiterName && <div><dt>{t('Recruiter name')}</dt><dd>{item.recruiterName}</dd></div>}
                {linkedInLink && <div className="recruiter-details-right"><dt>{t('Recruiter LinkedIn URL')} <a className="icon-button" href={linkedInLink} target="_blank" rel="noopener noreferrer" aria-label={t('Open LinkedIn')}><ExternalLink size={14} /></a></dt><dd>{item.recruiterLinkedIn}</dd></div>}
              </dl>}
              {(item.recruiterEmail || item.recruiterPhone) && <dl className="form-grid">
                {item.recruiterEmail && <div><dt>{t('Recruiter email')} {emailLink && <a className="icon-button" href={emailLink} aria-label={t('Email contact')}><Mail size={14} /></a>}</dt><dd>{item.recruiterEmail}</dd></div>}
                {item.recruiterPhone && <div className="recruiter-details-right"><dt>{t('Recruiter phone number')} {phoneLink && <a className="icon-button" href={phoneLink} aria-label={t('Call phone')}><Phone size={14} /></a>}</dt><dd>{item.recruiterPhone}</dd></div>}
              </dl>}
            </div>
          </section>}
          {item.status !== 'Interview' && decisionNote}
          {(isFollowUpColumn || (item.status !== 'Interested' && item.status !== 'Interview')) && reminder}
          {item.notes && <dl><dt>{t('Notes')}</dt><dd>{item.notes}</dd></dl>}
          {history}
          {saveError && <p role="alert" className="error">{t(saveError)}</p>}
        </div>
        <footer className="dialog-footer">
          <button type="button" className="secondary" disabled={busy} onClick={() => onDuplicate(item)}>{t('Duplicate opportunity')}</button>
          <button type="button" className="secondary" onClick={onClose}>{t('Close')}</button>
          <button type="button" className={item.status === 'Interested' || item.status === 'Interview' ? 'secondary' : 'primary'} onClick={() => setEditing(true)}>{t('Edit')}</button>
          {item.status === 'Interested' && <button type="button" className="primary" disabled={busy} onClick={() => onMarkApplied(item)}><Check size={15} /> {t('Mark as applied')}</button>}
          {item.status === 'Interview' && <button type="button" className="primary" disabled={busy} onClick={() => onFinishInterview(item)}><Check size={15} /> {item.interviewDone ? t('Next steps') : t('Mark as done')}</button>}
        </footer>
      </div> : <form onSubmit={submit}>
        <header className="dialog-header">
          <div>
            <p className="eyebrow">{item ? t('EDIT APPLICATION') : t('NEW OPPORTUNITY')}</p>
            <h2 id="dialog-title">{item ? item.company : trackingOpportunity ? t('Track an opportunity')
              : registeringInterest ? t('Save an opportunity') : t('Add application')}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={t('Close')} onClick={onClose}><X size={20} /></button>
        </header>
        <div className="dialog-body">
          <div className="form-grid">
            <label>{t('Company')}<input required maxLength={100} value={details.company} onChange={e => update('company', e.target.value)} placeholder={t('e.g. Spotify')} /></label>
            <label>{t('Location (optional)')}<input maxLength={120} value={details.location ?? ''} onChange={e => update('location', e.target.value)} placeholder={t('e.g. Stockholm / Remote')} /></label>
            <label>{t('Position')}<input required maxLength={120} value={details.position} onChange={e => update('position', e.target.value)} placeholder={t('e.g. Frontend Developer Intern')} /></label>
            <label>{t('Opportunity type')}<select value={details.kind} onChange={e => update('kind', e.target.value as Details['kind'])}><option value="Job">{t('Job')}</option><option value="Internship">{t('Internship')}</option></select></label>
            {(initial.status === 'Interested' || initial.applicationDeadline) && (
              <label className="full-width-field">{t('Application deadline (optional)')}
                <input type="date" min="1900-01-01" max="9999-12-31" value={details.applicationDeadline ?? ''} onChange={e => update('applicationDeadline', e.target.value || undefined)} />
              </label>
            )}
            {!registeringInterest && <>
              <label>{t('Application or contact date')}<input type="date" required={mode === 'interval'} min="1900-01-01" max="9998-12-31" value={details.contactDate} onChange={e => update('contactDate', e.target.value)} /></label>
              <label>{t('Contact method')}<select value={details.method} onChange={e => update('method', e.target.value as Details['method'])}><option value="">{t('Select a method')}</option>{methods.map(method => <option key={method} value={method}>{t(method)}</option>)}</select></label>
              {details.status === 'Completed' && <label>{t('Outcome')}<select value={details.outcome ?? ''} onChange={e => update('outcome', (e.target.value || undefined) as Details['outcome'])}><option value="">{t('Select an outcome')}</option>{outcomes.map(outcome => <option key={outcome} value={outcome}>{t(outcome)}</option>)}</select></label>}
            </>}
          </div>
          <section className="follow-settings" aria-labelledby="recruiter-title">
            <h3 id="recruiter-title">{t('Posting and recruiter (optional)')}</h3>
            <div className="form-grid">
              <label className="full-width-field">{t('Job posting link')}<input inputMode="url" maxLength={2000} value={details.postingUrl ?? ''} onChange={e => update('postingUrl', e.target.value)} placeholder="company.com/careers/role" /></label>
              <label>{t('Recruiter name')}<input maxLength={120} value={details.recruiterName ?? ''} onChange={e => update('recruiterName', e.target.value)} placeholder={t('e.g. Alex Andersson')} /></label>
              <label>{t('Recruiter LinkedIn URL')}<input inputMode="url" maxLength={2000} value={details.recruiterLinkedIn ?? ''} onChange={e => update('recruiterLinkedIn', e.target.value)} placeholder="linkedin.com/in/…" /></label>
              <label>{t('Recruiter email')}<input type="email" maxLength={254} value={details.recruiterEmail ?? ''} onChange={e => update('recruiterEmail', e.target.value)} placeholder={t('e.g. alex@company.com')} /></label>
              <label>{t('Recruiter phone number')}<input type="tel" maxLength={80} value={details.recruiterPhone ?? ''} onChange={e => update('recruiterPhone', e.target.value)} placeholder={t('e.g. +46 70 123 45 67')} /></label>
            </div>
          </section>
          {!registeringInterest && <>
            <section className="follow-settings" aria-labelledby="follow-title">
              <h3 id="follow-title"><CalendarClock size={17} /> {t('Follow-up')}</h3>
              {savedDue && <div className="saved-reminder"><span>{t('Scheduled for {date}', { date: formatDay(savedDue) })}</span><button type="button" className="secondary" disabled={hasEdits || busy} title={hasEdits ? t('Save your changes first') : undefined} onClick={() => item && onComplete(item)}><Check size={15} /> {t('Mark done')}</button></div>}
              <div className="form-grid">
                <label>{t('Reminder')}
                  <select value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
                    <option value="none">{t('No reminder')}</option>
                    <option value="date">{t('On a specific date')}</option>
                    {item && <option value="interval">{t('Days after contact')}</option>}
                  </select>
                </label>
                {mode === 'date' && <label>{t('Follow-up date')}<input type="date" required min="1900-01-01" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)} /></label>}
                {mode === 'interval' && <label>{t('Days after contact')}<input type="number" required min="0" max="3650" step="1" value={days} onChange={e => setDays(e.target.value)} /></label>}
              </div>
            </section>
            {details.status === 'Interview' && <section className="follow-settings" aria-labelledby="interview-title">
              <h3 id="interview-title"><CalendarClock size={17} /> {t('Interview details')}</h3>
              <InterviewFields interview={interview} onChange={value => update('interview', value)} />
            </section>}
          </>}
          {(details.status === 'Awaiting decision' || item?.decisionNote) && <label>{t('Decision note (optional)')}
            <textarea rows={3} maxLength={500} value={details.decisionNote ?? ''} onChange={e => update('decisionNote', e.target.value)} />
          </label>}
          <label>{t('Notes')}<textarea rows={3} maxLength={8000} value={details.notes} onChange={e => update('notes', e.target.value)} placeholder={registeringInterest ? t('Anything you want to remember about this opportunity…') : t('Contact details, next steps, or anything to remember…')} /></label>
          {history}
          {(saveError || error) && <p role="alert" className="error">{t(saveError || error)}</p>}
        </div>
        <footer className="dialog-footer">
          {item && <button type="button" className="secondary delete-application" disabled={busy} onClick={() => setConfirmDelete(true)}>{t('Delete application')}</button>}
          <button type="button" className="secondary" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" className="primary" disabled={busy}>{item ? t('Save changes') : trackingOpportunity ? t('Track opportunity')
            : registeringInterest ? t('Save opportunity') : t('Add application')}</button>
        </footer>
      </form>}
    </Modal>
    {item && confirmDelete && <Modal titleId="delete-title" onClose={() => setConfirmDelete(false)}>
      <header className="dialog-header"><h2 id="delete-title">{t('Delete application?')}</h2></header>
      <div className="dialog-body">
        <p>{t('Delete {position} at {company}? This also removes its reminder and history.', { position: item.position, company: item.company })}</p>
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>{t('Cancel')}</button>
        <button type="button" className="secondary delete-confirm" disabled={busy} onClick={() => {
          setConfirmDelete(false)
          onDelete(item)
        }}>{t('Delete application')}</button>
      </footer>
    </Modal>}
  </>
}
