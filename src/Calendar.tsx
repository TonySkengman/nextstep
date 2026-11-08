import { useLanguage } from './language'
import { useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { InterviewFields, emptyInterview, scheduledInterview } from './InterviewFields'
import { Modal } from './Modal'
import { addDays, calendarEvents, followUpDate, localDay } from './model'
import type { Application, CalendarEvent, Details } from './model'

const dailyPreviewLimit = 4
const monthPreviewLimit = 2
const eventKinds = ['Follow-up', 'Interview', 'Deadline'] as const
const eventDots = { 'Follow-up': 'follow-dot', Interview: 'interview-dot', Deadline: 'deadline-dot' }
const eventTones = { 'Follow-up': 'red', Interview: 'teal', 'Deadline': 'violet' }

function EventButton({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const { t } = useLanguage()
  const { kind } = event
  const label = `${t(kind === 'Deadline' ? 'Application deadline' : kind)} · ${event.item.company} · ${event.item.position}${event.time ? ` · ${event.time}` : ''}`
  return <button type="button" className={`calendar-event tone-${eventTones[kind]}`} title={label} aria-label={label} onClick={onOpen}>
    <span className="calendar-event-details">{event.time && <span className="calendar-event-time">{event.time} </span>}{event.item.company}</span>
    <span className="calendar-event-kind">{t(kind)}</span>
  </button>
}

function CalendarLegend() {
  const { t } = useLanguage()
  return <div className="calendar-legend">{eventKinds.map(kind => <span key={kind}>
    <i className={eventDots[kind]} /> {t(kind === 'Deadline' ? 'Application deadline' : kind)}
  </span>)}</div>
}

type SaveEvent = (details: Details, item: Application, day: string) => Promise<boolean>

export function Calendar({ items, today, selected, setSelected, onOpen, onSaveEvent }: {
  items: Application[]
  today: string
  selected: string | null
  setSelected: (day: string | null) => void
  onOpen: (item: Application) => void
  onSaveEvent: SaveEvent
}) {
  const { t, formatDay, locale } = useLanguage()
  const eventsByDay = calendarEvents(items)

  return <section className="calendar-preview" aria-label={t('Calendar for the next seven days')}>
    <div className="calendar-heading">
      <CalendarDays size={17} /> <strong>{t('Next 7 days')}</strong>
      <button type="button" aria-haspopup="dialog" onClick={() => setSelected(today)}>
        {t('Open calendar')} <ArrowUpRight size={14} />
      </button>
    </div>
    <div className="calendar-week">
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(today, index)
        const events = eventsByDay.get(day) ?? []
        return <div className="calendar-day" key={day}>
          <button className="calendar-day-heading" aria-current={day === today ? 'date' : undefined} aria-label={t('Open calendar for {date}', { date: formatDay(day) })} onClick={() => setSelected(day)}>
            <span>{index === 0 ? t('Today') : new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' })}</span>
            <strong>{Number(day.slice(-2))}</strong>
          </button>
          {events.slice(0, dailyPreviewLimit).map(event => <EventButton key={`${event.item.id}-${event.kind}`} event={event} onOpen={() => onOpen(event.item)} />)}
          {events.length > dailyPreviewLimit && <button className="calendar-more" onClick={() => setSelected(day)}>+{events.length - dailyPreviewLimit} {t('more')}</button>}
        </div>
      })}
    </div>
    <CalendarLegend />
    {selected && <MonthCalendar initialDay={selected} today={today} eventsByDay={eventsByDay} items={items} onSaveEvent={onSaveEvent} onClose={() => setSelected(null)} onOpen={item => {
      setSelected(null)
      onOpen(item)
    }} />}
  </section>
}

function MonthCalendar({ initialDay, today, eventsByDay, items, onClose, onOpen, onSaveEvent }: {
  initialDay: string
  today: string
  eventsByDay: Map<string, CalendarEvent[]>
  items: Application[]
  onSaveEvent: SaveEvent
  onClose: () => void
  onOpen: (item: Application) => void
}) {
  const { t, formatDay, locale } = useLanguage()
  const [selected, setSelected] = useState(initialDay)
  const [addingEvent, setAddingEvent] = useState(false)
  const firstDay = `${selected.slice(0, 7)}-01`
  const month = new Date(`${firstDay}T12:00:00`)
  const offset = (month.getDay() + 6) % 7
  const end = new Date(month)
  end.setMonth(end.getMonth() + 1, 0)
  const selectedEvents = eventsByDay.get(selected) ?? []

  function changeMonth(by: number) {
    const next = new Date(month)
    next.setMonth(next.getMonth() + by)
    setSelected(localDay(next))
  }

  return <Modal className="month-calendar" titleId="calendar-title" onClose={onClose}>
    <header className="dialog-header">
      <h2 id="calendar-title">{t('Calendar')}</h2>
      <button className="icon-button" aria-label={t('Close calendar')} onClick={onClose}><X size={20} /></button>
    </header>
    <div className="dialog-body">
      <div className="month-toolbar">
        <button className="icon-button" aria-label={t('Previous month')} onClick={() => changeMonth(-1)}><ChevronLeft size={19} /></button>
        <h3 aria-live="polite">{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h3>
        <button className="icon-button" aria-label={t('Next month')} onClick={() => changeMonth(1)}><ChevronRight size={19} /></button>
      </div>
      <div className="month-actions">
        <CalendarLegend />
        <button type="button" className="secondary" onClick={() => setAddingEvent(true)}><Plus size={15} /> {t('Add event')}</button>
      </div>
      <div className="month-grid">
        {Array.from({ length: 7 }, (_, index) => {
          const day = new Date(2024, 0, index + 1)
          return <span className="month-weekday" key={index}>{day.toLocaleDateString(locale, { weekday: 'short' })}</span>
        })}
        {Array.from({ length: offset }, (_, index) => <span key={index} />)}
        {Array.from({ length: end.getDate() }, (_, index) => {
          const day = addDays(firstDay, index)
          const events = eventsByDay.get(day) ?? []
          return <button key={day} className="month-day" aria-current={day === today ? 'date' : undefined} aria-pressed={day === selected} aria-label={`${formatDay(day)}, ${events.length} ${events.length === 1 ? t('event') : t('events')}`} onClick={() => setSelected(day)}>
            {index + 1}
            {events.slice(0, monthPreviewLimit).map(event => <span key={`${event.item.id}-${event.kind}`} className={`month-event tone-${eventTones[event.kind]}`} title={`${t(event.kind)} · ${event.item.company}`}>
              <span>{event.time && `${event.time} `}{event.item.company}</span>
            </span>)}
            {events.length > monthPreviewLimit && <span className="month-more">+{events.length - monthPreviewLimit} {t('more')}</span>}
          </button>
        })}
      </div>
      <section className="calendar-agenda" aria-labelledby="agenda-title">
        <h3 id="agenda-title">{formatDay(selected)}</h3>
        {selectedEvents.length === 0 && <p>{t('No events scheduled.')}</p>}
        {selectedEvents.map(event => <EventButton key={`${event.item.id}-${event.kind}`} event={event} onOpen={() => onOpen(event.item)} />)}
      </section>
    </div>
    {addingEvent && <CalendarEventDialog day={selected} items={items} onClose={() => setAddingEvent(false)} onSave={async (details, item, day) => {
      if (!await onSaveEvent(details, item, day)) return false
      setSelected(day)
      setAddingEvent(false)
      return true
    }} />}
  </Modal>
}

function CalendarEventDialog({ day, items, onClose, onSave }: {
  day: string
  items: Application[]
  onClose: () => void
  onSave: SaveEvent
}) {
  const { t, formatDay } = useLanguage()
  const [kind, setKind] = useState<CalendarEvent['kind']>('Follow-up')
  const [itemId, setItemId] = useState('')
  const [interview, setInterview] = useState({ ...emptyInterview, date: day })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const eligible = items.filter(item => {
    if (kind === 'Deadline') return item.status === 'Interested'
    if (item.status === 'Interested' || item.status === 'Completed') return false
    return kind !== 'Interview' || !item.interview?.date
  })
  const item = eligible.find(item => item.id === itemId)
  const replacesDate = item && (kind === 'Deadline' ? item.applicationDeadline : kind === 'Follow-up' && followUpDate(item))

  async function saveEvent() {
    if (!item || busy) return
    const scheduled = kind === 'Interview' ? scheduledInterview(interview) : undefined
    if (kind === 'Interview' && !scheduled) return
    const details: Details = scheduled
      ? { ...item, status: 'Interview', interview: scheduled, interviewDone: false }
      : kind === 'Deadline' ? { ...item, applicationDeadline: day }
      : { ...item, followUp: { mode: 'date', date: day } }
    setBusy(true)
    setFailed(false)
    try {
      if (!await onSave(details, item, scheduled?.date ?? day)) setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return <Modal titleId="add-calendar-event-title" onClose={() => { if (!busy) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void saveEvent() }}>
      <header className="dialog-header"><h2 id="add-calendar-event-title">{t('Add event')} · {formatDay(day)}</h2></header>
      <div className="dialog-body">
        <label>{t('Event type')}
          <select value={kind} disabled={busy} onChange={event => {
            setKind(event.target.value as CalendarEvent['kind'])
            setItemId('')
          }}>
            {eventKinds.map(value => <option key={value} value={value}>{t(value === 'Deadline' ? 'Application deadline' : value)}</option>)}
          </select>
        </label>
        {eligible.length ? <label>{t('Application')}
          <select value={itemId} required disabled={busy} onChange={event => setItemId(event.target.value)}>
            <option value="">{t('Select an application')}</option>
            {eligible.map(item => <option key={item.id} value={item.id}>{item.company} · {item.position}</option>)}
          </select>
        </label> : <p>{t('No applications available for this event type.')}</p>}
        {item && kind === 'Interview' && <InterviewFields interview={interview} onChange={setInterview} requireDate />}
        {replacesDate && replacesDate !== day && <p>{t('This will replace the date currently set for this application.')}</p>}
        {failed && <p className="error" role="alert">{t('Could not save your changes. Try again.')}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" disabled={busy} onClick={onClose}>{t('Cancel')}</button>
        <button type="submit" className="primary" disabled={!item || busy}>{t('Save event')}</button>
      </footer>
    </form>
  </Modal>
}
