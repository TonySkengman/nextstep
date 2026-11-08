import { useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Modal } from './Modal'
import { addDays, calendarEvents, formatDay, localDay } from './model'
import type { Application, CalendarEvent } from './model'

const dailyPreviewLimit = 4

function EventButton({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const { kind } = event
  const label = `${kind} · ${event.item.company} · ${event.item.position}${event.time ? ` · ${event.time}` : ''}`
  return <button type="button" className={`calendar-event tone-${event.kind === 'Interview' ? 'teal' : 'amber'}`} title={label} aria-label={label} onClick={onOpen}>
    <span className="calendar-event-details">{event.time && <span className="calendar-event-time">{event.time} </span>}{event.item.company}</span>
    <span className="calendar-event-kind">{kind}</span>
  </button>
}

export function Calendar({ items, today, onOpen }: { items: Application[]; today: string; onOpen: (item: Application) => void }) {
  const eventsByDay = calendarEvents(items)
  const [selected, setSelected] = useState<string | null>(null)

  return <section className="calendar-preview" aria-label="Calendar for the next seven days">
    <button className="calendar-heading" onClick={() => setSelected(today)}>
      <CalendarDays size={17} /> <strong>Next 7 days</strong><span>Open calendar <ArrowUpRight size={14} /></span>
    </button>
    <div className="calendar-week">
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(today, index)
        const events = eventsByDay.get(day) ?? []
        return <div className="calendar-day" key={day}>
          <button className="calendar-day-heading" aria-current={day === today ? 'date' : undefined} aria-label={`Open calendar for ${formatDay(day)}`} onClick={() => setSelected(day)}>
            <span>{index === 0 ? 'Today' : new Date(`${day}T12:00:00`).toLocaleDateString('en', { weekday: 'short' })}</span>
            <strong>{Number(day.slice(-2))}</strong>
          </button>
          {events.slice(0, dailyPreviewLimit).map(event => <EventButton key={`${event.item.id}-${event.kind}`} event={event} onOpen={() => onOpen(event.item)} />)}
          {events.length > dailyPreviewLimit && <button className="calendar-more" onClick={() => setSelected(day)}>+{events.length - dailyPreviewLimit} more</button>}
        </div>
      })}
    </div>
    <div className="calendar-legend"><span><i className="follow-dot" /> Follow-up</span><span><i className="interview-dot" /> Interview</span></div>
    {selected && <MonthCalendar initialDay={selected} today={today} eventsByDay={eventsByDay} onClose={() => setSelected(null)} onOpen={item => {
      setSelected(null)
      onOpen(item)
    }} />}
  </section>
}

function MonthCalendar({ initialDay, today, eventsByDay, onClose, onOpen }: {
  initialDay: string
  today: string
  eventsByDay: Map<string, CalendarEvent[]>
  onClose: () => void
  onOpen: (item: Application) => void
}) {
  const [selected, setSelected] = useState(initialDay)
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
      <h2 id="calendar-title">Calendar</h2>
      <button className="icon-button" aria-label="Close calendar" onClick={onClose}><X size={20} /></button>
    </header>
    <div className="dialog-body">
      <div className="month-toolbar">
        <button className="icon-button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={19} /></button>
        <h3 aria-live="polite">{month.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h3>
        <button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={19} /></button>
      </div>
      <div className="month-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span className="month-weekday" key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={index} />)}
        {Array.from({ length: end.getDate() }, (_, index) => {
          const day = addDays(firstDay, index)
          const events = eventsByDay.get(day) ?? []
          return <button key={day} className="month-day" aria-current={day === today ? 'date' : undefined} aria-pressed={day === selected} aria-label={`${formatDay(day)}, ${events.length} ${events.length === 1 ? 'event' : 'events'}`} onClick={() => setSelected(day)}>
            {index + 1}
            <span className="month-dots" aria-hidden="true">
              {events.some(event => event.kind === 'Follow-up') && <i className="follow-dot" />}
              {events.some(event => event.kind === 'Interview') && <i className="interview-dot" />}
            </span>
          </button>
        })}
      </div>
      <section className="calendar-agenda" aria-labelledby="agenda-title">
        <h3 id="agenda-title">{formatDay(selected)}</h3>
        {selectedEvents.length === 0 && <p>No follow-ups or interviews scheduled.</p>}
        {selectedEvents.map(event => <EventButton key={`${event.item.id}-${event.kind}`} event={event} onOpen={() => onOpen(event.item)} />)}
      </section>
    </div>
  </Modal>
}
