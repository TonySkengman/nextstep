import { useState } from 'react'
import { InterviewFields, emptyInterview, scheduledInterview } from './InterviewFields'
import { Modal } from './Modal'
import { formatDay } from './model'
import type { Application, Interview } from './model'

export function InterviewDialog({ item, saveError, busy, onClose, onSave }: {
  item: Application
  saveError: string
  busy: boolean
  onClose: () => void
  onSave: (interview: Interview | undefined) => void
}) {
  const [interview, setInterview] = useState(item.status === 'Interview' && item.interview ? item.interview : emptyInterview)

  return <Modal titleId="schedule-interview-title" className="interview-dialog" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); onSave(scheduledInterview(interview)) }}>
      <header className="dialog-header"><h2 id="schedule-interview-title">Schedule interview</h2></header>
      <div className="dialog-body">
        <section className="interview-overview" aria-label="Application overview">
          <h3>{item.company}</h3>
          <p>{item.position} · {item.kind}</p>
          {item.recruiterName && <p>Recruiter · {item.recruiterName}</p>}
          {item.contactDate && <p>Application or contact date · {formatDay(item.contactDate)}</p>}
        </section>
        <p>Add a date to show the interview on your calendar. If you’re still waiting for a date, you can move the card now and schedule it later.</p>
        <InterviewFields interview={interview} onChange={setInterview} />
        {saveError && <p className="error" role="alert">{saveError}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="primary" disabled={busy}>{interview.date ? 'Save interview' : 'Move to Interview'}</button>
      </footer>
    </form>
  </Modal>
}
