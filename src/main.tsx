import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, CalendarClock, Check, CircleCheck, Columns3, Compass, Inbox, Plus, Search, X } from 'lucide-react'
import { ApplicationDialog } from './ApplicationDialog'
import { blankDetails, boardColumn, columns, completeFollowUp, followUpDate, formatDay, localDay, saveDetails } from './model'
import type { Application, Column, Details, Kind, Status } from './model'
import './style.css'

const storageKey = 'nextstep:applications:v1'
type Workspace = { items: Application[]; exampleIds: string[] }
type Filter = Column | 'All' | 'Active'
const colors: Record<Column, string> = {
  Interested: 'slate', Applied: 'blue', 'Follow Up': 'amber',
  'In Contact': 'violet', Interview: 'teal', Completed: 'green',
}

function loadWorkspace(cleanup = false): Workspace {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const workspace: { items: (Omit<Application, 'kind'> & { kind: Kind | 'LIA internship' })[]; exampleIds: string[] } = JSON.parse(stored)
      if (Array.isArray(workspace.items) && Array.isArray(workspace.exampleIds)) {
        const items = workspace.items.map(({ kind, ...item }) => ({
          ...item,
          kind: kind === 'LIA internship' ? 'Internship' as const : kind,
        }))
        if (!workspace.exampleIds.length) return { items, exampleIds: [] }

        const exampleIds = new Set(workspace.exampleIds)
        const cleaned = { items: items.filter(item => !exampleIds.has(item.id)), exampleIds: [] }
        if (cleanup) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(cleaned))
          } catch {
            // Still show only real applications if storage is read-only.
          }
        }
        return cleaned
      }
    }
  } catch {
    // Start with an empty board if stored data cannot be read.
  }
  return { items: [], exampleIds: [] }
}

function ApplicationCard({ item, today, onOpen, onComplete }: {
  item: Application; today: string; onOpen: () => void; onComplete: () => void
}) {
  const date = followUpDate(item)
  const due = boardColumn(item, today) === 'Follow Up'
  const initials = item.company.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase()
  const avatarColor = ['violet', 'teal', 'blue', 'amber', 'green'][item.company.charCodeAt(0) % 5]
  return <article className={`application ${due ? 'application-due' : ''}`}>
    <button className="card-open" onClick={onOpen} aria-label={`Open ${item.company}, ${item.position}`}>
      <span className="card-top">
        <span className="company-line"><span className={`avatar tone-${avatarColor}`}>{initials}</span><span>{item.company}</span></span>
        <ArrowUpRight className="card-arrow" size={16} />
      </span>
      <span className="position">{item.position}</span>
      <span className={`tag ${item.kind === 'Job' ? 'job' : 'internship'}`}>{item.kind}</span>
      {item.contactDate && <span className="contact-date"><CalendarDays size={13} /> {formatDay(item.contactDate)}</span>}
    </button>
    {date && item.status !== 'Completed' && <div className={`reminder ${due ? 'tone-amber' : ''}`}>
      <div>
        <div className="flex items-center gap-1.5"><CalendarClock size={14} /> {due ? (date === today ? 'Due today' : 'Overdue') : formatDay(date)}</div>
        {due && <span className="reminder-stage">{item.status} · {formatDay(date)}</span>}
      </div>
      <button className="icon-button" aria-label={`Complete follow-up for ${item.company}`} title="Mark follow-up done" onClick={onComplete}><Check size={16} /></button>
    </div>}
  </article>
}

function App() {
  const [workspace, setWorkspace] = useState(() => loadWorkspace())
  const [today, setToday] = useState(localDay)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | 'All'>('All')
  const [filter, setFilter] = useState<Filter>('All')
  const [editor, setEditor] = useState<{ item: Application } | { status: Status } | null>(null)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    const refresh = () => setToday(localDay())
    const timer = window.setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  useEffect(() => {
    setWorkspace(loadWorkspace(true))
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue) setWorkspace(loadWorkspace())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function persist(next: Workspace, message: string) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
    setWorkspace(next)
    setNotice(message)
  }

  function save(details: Details, previous?: Application) {
    const latest = loadLatest()
    const current = previous && latest.items.find(item => item.id === previous.id)
    if (previous && !current) {
      setEditor(null)
      setNotice('This application was removed in another tab.')
      return
    }
    if (previous && JSON.stringify(current) !== JSON.stringify(previous)) {
      setEditor(null)
      setNotice('This application changed in another tab. Open it again to edit the latest version.')
      return
    }
    const item = saveDetails(details, current)
    const items = current ? latest.items.map(existing => existing.id === item.id ? item : existing) : [...latest.items, item]
    persist({ ...latest, items }, current ? 'Application updated.' : 'Application added.')
    if (!current) {
      setFilter('All')
      setKind('All')
      setQuery('')
    }
    setEditor(null)
  }

  function loadLatest() {
    if (storageError) return workspace
    try {
      return localStorage.getItem(storageKey) ? loadWorkspace() : workspace
    } catch {
      return workspace
    }
  }

  function deleteApplication(item: Application) {
    const latest = loadLatest()
    const current = latest.items.find(entry => entry.id === item.id)
    setEditor(null)
    if (!current || JSON.stringify(current) !== JSON.stringify(item)) {
      setNotice(current ? 'This application changed in another tab. Open it again to delete it.' : 'This application was removed in another tab.')
      return
    }
    const items = latest.items.filter(entry => entry.id !== item.id)
    persist({ ...latest, items }, 'Application deleted.')
  }

  function markDone(item: Application) {
    const latest = loadLatest()
    const current = latest.items.find(entry => entry.id === item.id)
    if (!current || JSON.stringify(current.followUp) !== JSON.stringify(item.followUp) || followUpDate(current) !== followUpDate(item)) {
      setEditor(null)
      setNotice('This reminder changed in another tab. Open the application to see the latest reminder.')
      return
    }
    const items = latest.items.map(entry => entry.id === item.id ? completeFollowUp(current) : entry)
    persist({ ...latest, items }, `Follow-up completed for ${item.company}.`)
    setEditor(null)
  }

  const items = workspace.items
  const dueCount = items.filter(item => boardColumn(item, today) === 'Follow Up').length
  const summaries = [
    { title: 'Total opportunities', value: items.length, caption: 'Jobs and internships', icon: BriefcaseBusiness, tone: 'violet', filter: 'All' },
    { title: 'Active applications', value: items.filter(item => item.status !== 'Interested' && item.status !== 'Completed').length, caption: 'Applied, in contact or interviewing', icon: ArrowUpRight, tone: 'blue', filter: 'Active' },
    { title: 'Follow-ups due', value: dueCount, caption: 'Due today or overdue', icon: CalendarClock, tone: 'amber', filter: 'Follow Up' },
    { title: 'Completed', value: items.filter(item => item.status === 'Completed').length, caption: 'Closed opportunities', icon: CircleCheck, tone: 'teal', filter: 'Completed' },
  ] as const
  const matching = items.filter(item => {
    const search = query.trim().toLocaleLowerCase()
    return (kind === 'All' || item.kind === kind)
      && `${item.company} ${item.position}`.toLocaleLowerCase().includes(search)
      && (filter === 'All'
        || (filter === 'Active' && item.status !== 'Interested' && item.status !== 'Completed')
        || filter === boardColumn(item, today))
  })
  const visibleColumns = filter === 'Active' ? columns.filter(column => column !== 'Interested' && column !== 'Completed')
    : filter === 'All' ? columns : [filter]

  return <>
    <header className="topbar">
      <div className="brand"><span className="brand-icon"><Compass size={23} /></span>nextstep<span className="brand-dot">.</span></div>
      <div className="top-date"><CalendarDays size={16} />{new Date(`${today}T12:00:00`).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
    </header>
    <main>
      <div className="page-heading">
        <div>
          <p className="eyebrow"><span className="live-dot" /> CAREER WORKSPACE</p>
          <h1>Take your next step</h1>
          <p>Keep your opportunities organized and your next steps clear.</p>
        </div>
        <button className="primary" onClick={() => setEditor({ status: 'Interested' })}><Plus size={19} /> New application</button>
      </div>
      <section className="summary-grid" aria-label="Application summary">
        {summaries.map(summary => <button className={`summary ${filter !== 'All' && filter === summary.filter ? 'selected' : ''}`} key={summary.title} aria-pressed={filter === summary.filter} onClick={() => setFilter(filter === summary.filter ? 'All' : summary.filter)}>
          <span className="summary-top"><span className={`metric-icon tone-${summary.tone}`}><summary.icon size={19} /></span><ArrowDownRight className="metric-arrow" size={16} /></span>
          <span className="metric-value">{summary.value}</span>
          <span className="metric-title">{summary.title}</span>
          <span className="metric-caption">{summary.caption}</span>
        </button>)}
      </section>
      <section className="board-panel" aria-labelledby="board-title">
        <div className="board-toolbar">
          <div className="board-title"><span className="board-icon"><Columns3 size={19} /></span><div><h2 id="board-title">Application board</h2><p>{matching.length} {matching.length === 1 ? 'opportunity' : 'opportunities'}{filter !== 'All' && ` · ${filter}`}</p></div></div>
          <div className="filters">
            {filter !== 'All' && <button className="secondary" onClick={() => setFilter('All')}><X size={15} /> Clear stage filter</button>}
            <label className="search"><Search size={17} /><input type="search" aria-label="Search applications" placeholder="Search applications…" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <select aria-label="Opportunity type filter" value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="All">All types</option><option>Job</option><option>Internship</option></select>
          </div>
        </div>
        <div className="board-scroll" role="region" aria-label="Kanban board" tabIndex={0}>
          <div className="board" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(175px, ${visibleColumns.length === 1 ? '280px' : '1fr'}))` }}>
            {visibleColumns.map(column => {
              const cards = matching.filter(item => boardColumn(item, today) === column)
              if (column === 'Follow Up') cards.sort((a, b) => (followUpDate(a) ?? '').localeCompare(followUpDate(b) ?? ''))
              return <section key={column} className={`lane lane-${colors[column]}`} aria-label={column}>
                <header className="lane-header">
                  <h3><span className="lane-dot" />{column}<span className="count">{cards.length}</span></h3>
                  {column !== 'Follow Up' && <button className="icon-button" aria-label={`Add to ${column}`} onClick={() => setEditor({ status: column })}><Plus size={16} /></button>}
                </header>
                <div className="lane-cards">
                  {cards.map(item => <ApplicationCard key={item.id} item={item} today={today} onOpen={() => setEditor({ item })} onComplete={() => markDone(item)} />)}
                  {!cards.length && <div className="empty"><Inbox size={19} />{column === 'Follow Up' ? 'No reminders due' : 'No applications here'}</div>}
                </div>
              </section>
            })}
          </div>
        </div>
      </section>
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button></div>}
      {storageError && <p className="error" role="alert">Browser storage is unavailable. Changes may be lost when you close or reload this page.</p>}
    </main>
    {editor && <ApplicationDialog initial={'item' in editor ? editor.item : blankDetails(editor.status)} item={'item' in editor ? editor.item : undefined} onClose={() => setEditor(null)} onSave={details => save(details, 'item' in editor ? editor.item : undefined)} onComplete={markDone} onDelete={deleteApplication} />}
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
