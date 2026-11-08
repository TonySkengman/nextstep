import { useLanguage } from './language'
import { useState } from 'react'
import { InterviewFields, emptyInterview, scheduledInterview } from './InterviewFields'
import { Modal } from './Modal'
import type { Application, Interview } from './model'

export function InterviewDialog({ item, saveError, busy, nextRound = false, onClose, onSave }: {
  item: Application
  saveError: string
  busy: boolean
  nextRound?: boolean
  onClose: () => void
  onSave: (interview: Interview | undefined) => void
}) {
  const { t, formatDay } = useLanguage()
  const [interview, setInterview] = useState(!nextRound && item.status === 'Interview' && item.interview ? item.interview : emptyInterview)

  return <Modal titleId="schedule-interview-title" className="interview-dialog" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); onSave(scheduledInterview(interview)) }}>
      <header className="dialog-header"><h2 id="schedule-interview-title">{nextRound ? t('Schedule next interview') : t('Schedule interview')}</h2></header>
      <div className="dialog-body">
        <section className="interview-overview" aria-label={t('Application overview')}>
          <h3>{item.company}</h3>
          <p>{item.position} · {t(item.kind)}</p>
          {item.recruiterName && <p>{t('Recruiter')} · {item.recruiterName}</p>}
          {item.contactDate && <p>{t('Application or contact date')} · {formatDay(item.contactDate)}</p>}
        </section>
        {!nextRound && <p>{t('Add a date to show the interview on your calendar. If you’re still waiting for a date, you can move the card now and schedule it later.')}</p>}
        <InterviewFields interview={interview} onChange={setInterview} requireDate={nextRound} />
        {saveError && <p className="error" role="alert">{t(saveError)}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={onClose}>{t('Cancel')}</button>
        <button type="submit" className="primary" disabled={busy}>{nextRound || interview.date ? t('Save interview') : t('Move to Interview')}</button>
      </footer>
    </form>
  </Modal>
}
