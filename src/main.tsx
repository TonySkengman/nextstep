import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, CalendarClock, Check, CircleCheck, Columns3, Compass, Inbox, MapPin, Plus, Search, X } from 'lucide-react'
import { Account } from './Account'
import type { AccountBoard, SavedApplication } from './supabase'
import { ApplicationDialog } from './ApplicationDialog'
import { Calendar } from './Calendar'
import { InterviewDialog } from './InterviewDialog'
import { Modal } from './Modal'
import { OutcomeDialog } from './OutcomeDialog'
import { OutcomeBadge } from './OutcomeBadge'
import { addDays, archiveInterview, blankDetails, boardColumn, columns, completeFollowUp, followUpCount, followUpDate, formatDay, localDay, normalizeApplication, outcomes, saveDetails } from './model'
import type { Application, Column, Details, Kind, Status } from './model'
import './style.css'

const storageKey = 'nextstep:applications:v1'
const boardColumnsKey = 'nextstep:visible-columns:v2'
const applicationDragType = 'application/x-nextstep-card'
type Workspace = { items: Application[]; exampleIds: string[] }
type Filter = Column | 'All' | 'Active'

function loadBoardColumns(): Column[] {
  try {
    const current = localStorage.getItem(boardColumnsKey)
    const saved: unknown = JSON.parse(current ?? localStorage.getItem('nextstep:visible-columns:v1') ?? 'null')
    if (Array.isArray(saved)) {
      const visible = columns.filter(column => saved.includes(column))
      if (visible.length) return current || visible.includes('Awaiting response') ? visible : [...visible, 'Awaiting response']
    }
  } catch {
    // Use the default layout if browser storage is unavailable.
  }
  return [...columns]
}

function isActiveApplication(item: Application) {
  return item.status !== 'Interested' && item.status !== 'Completed'
}

function opportunityBadges(items: Application[]) {
  return (['Job', 'Internship'] as const).map(kind => {
    const count = items.filter(item => item.kind === kind).length
    return count > 0 && <span key={kind} className={`tag ${kind.toLowerCase()}`}>{count} {kind}{count === 1 ? '' : 's'}</span>
  })
}

const colors: Record<Column, string> = {
  Interested: 'slate', Applied: 'blue', 'Follow-up': 'red',
  'In Contact': 'violet', Interview: 'teal', 'Awaiting response': 'amber', Completed: 'green',
}

function loadWorkspace(cleanup = false): Workspace {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const workspace: { items: (Omit<Application, 'kind'> & { kind: Kind | 'LIA internship' })[]; exampleIds: string[] } = JSON.parse(stored)
      if (Array.isArray(workspace.items) && Array.isArray(workspace.exampleIds)) {
        const items = workspace.items.map(({ kind, ...item }) => normalizeApplication({
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
  const due = boardColumn(item, today) === 'Follow-up'
  const followedUp = followUpCount(item)
  const deadline = item.status === 'Interested' ? item.applicationDeadline ?? '' : ''
  const deadlineSoon = deadline >= today && deadline <= addDays(today, 3)
  const initials = item.company.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase()
  const avatarColor = ['violet', 'teal', 'blue', 'amber', 'green'][item.company.charCodeAt(0) % 5]
  return <article className={`application ${due ? 'application-due' : ''}`} draggable onDragStart={event => {
    event.dataTransfer.setData(applicationDragType, item.id)
    event.dataTransfer.effectAllowed = 'move'
  }}>
    <button className="card-open" onClick={onOpen} aria-label={`Open ${item.company}, ${item.position}`}>
      <span className="card-top">
        <span className="company-line"><span className={`avatar tone-${avatarColor}`}>{initials}</span><span>{item.company}</span></span>
        <ArrowUpRight className="card-arrow" size={16} />
      </span>
      <span className="position">{item.position}</span>
      <span className="card-tags">
        <span className={`tag ${item.kind === 'Job' ? 'job' : 'internship'}`}>{item.kind}</span>
        {item.status === 'Completed' && item.outcome && <OutcomeBadge outcome={item.outcome} />}
      </span>
      {deadline && <span className={`contact-date${deadlineSoon ? ' deadline-soon' : ''}`}>
        <CalendarDays size={13} /> {deadline === today ? 'Apply today' : `Apply by ${formatDay(deadline)}`}
      </span>}
      {item.location && <span className="contact-date"><MapPin size={13} className="shrink-0" /><span className="card-location">{item.location}</span></span>}
      {item.contactDate && <span className="contact-date"><CalendarDays size={13} /> {formatDay(item.contactDate)}</span>}
      {followedUp > 0 && <span className="contact-date"><Check size={13} /> Followed up {followedUp} {followedUp === 1 ? 'time' : 'times'}</span>}
      {item.status === 'Interview' && (item.interviewDone
        ? <span className="contact-date"><Check size={13} /> Interview done</span>
        : item.interview && <span className="contact-date"><CalendarClock size={13} /> Interview {formatDay(item.interview.date)}{item.interview.time && ` · ${item.interview.time}`}</span>)}
    </button>
    {date && item.status !== 'Completed' && <div className={`reminder ${due ? 'tone-red' : ''}`}>
      <div>
        <div className="flex items-center gap-1.5"><CalendarClock size={14} /> {due ? (date === today ? 'Due today' : 'Overdue') : formatDay(date)}</div>
        {due && <span className="reminder-date">{formatDay(date)}</span>}
      </div>
      <button className="icon-button" aria-label={`Complete follow-up for ${item.company}`} title="Mark follow-up done" onClick={onComplete}><Check size={16} /></button>
    </div>}
  </article>
}

function App({ board, email, signOut, exitGuest }: {
  board?: AccountBoard; email?: string; signOut?: () => Promise<void>; exitGuest?: () => void
}) {
  const [workspace, setWorkspace] = useState(() => board ? { items: [], exampleIds: [] } : loadWorkspace())
  const [rows, setRows] = useState<SavedApplication[] | null>(null)
  const [guestItems, setGuestItems] = useState(() => board ? loadWorkspace().items : [])
  const [importDismissed, setImportDismissed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)
  const writing = useRef(false)
  const [today, setToday] = useState(localDay)
  const [calendarDay, setCalendarDay] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | 'All'>('All')
  const [filter, setFilter] = useState<Filter>('All')
  const [boardColumns, setBoardColumns] = useState(loadBoardColumns)
  const [draftColumns, setDraftColumns] = useState<Column[] | null>(null)
  const [editor, setEditor] = useState<{ item: Application; status?: Status; finishInterview?: boolean } | { status: Status } | 'pickCompleted' | 'pickInterview' | null>(null)
  const [interviewFollowUpDate, setInterviewFollowUpDate] = useState<string | null>(null)
  const [followUpPrompt, setFollowUpPrompt] = useState<Application | null>(null)
  const [promptDate, setPromptDate] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')

  useEffect(() => {
    const refresh = () => setToday(localDay())
    const timer = window.setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])

  useEffect(() => {
    if (!board) setWorkspace(loadWorkspace(true))
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== storageKey && event.key !== null)) return
      const saved = loadWorkspace()
      if (board) setGuestItems(saved.items)
      else setWorkspace(saved)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [board])

  useEffect(() => {
    if (!board) return
    setLoadError(false)
    let active = true
    board.read().then(saved => {
      if (!active) return
      setRows(saved)
      setWorkspace({ items: saved.map(row => normalizeApplication(row.data)), exampleIds: [] })
    }).catch(() => {
      if (active) setLoadError(true)
    })
    return () => { active = false }
  }, [board, reload])

  const accountIds = new Set(rows?.map(row => row.id))
  const importable = guestItems.filter(item => !accountIds.has(item.id))

  async function importGuestBoard() {
    if (!board || !rows || writing.current) return
    const items = loadWorkspace().items
    setGuestItems(items)
    const pending = items.filter(item => !accountIds.has(item.id))
    if (!pending.length) return

    writing.current = true
    setImporting(true)
    setImportError('')
    try {
      await board.importGuest(pending)
      setNotice('Guest applications imported.')
      setRows(null)
      setReload(value => value + 1)
    } catch {
      setImportError('Could not import your guest applications. Try again.')
    } finally {
      writing.current = false
      setImporting(false)
    }
  }

  async function persist(next: Workspace, message: string, change: Application | null, id: string) {
    if (board) {
      if (writing.current || !rows) return false
      writing.current = true
      setSaveError('')
      try {
        await board.write(change, rows.find(row => row.id === id))
        setNotice(message)
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save your changes. Try again.'
        if (editor || followUpPrompt) setSaveError(message)
        else setNotice(message)
        return false
      } finally {
        writing.current = false
        setRows(null)
        setReload(value => value + 1)
      }
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
    setWorkspace(next)
    setNotice(message)
    return true
  }

  async function save(details: Details, previous?: Application) {
    const latest = loadLatest()
    const current = previous && latest.items.find(item => item.id === previous.id)
    if (previous && !current) {
      setEditor(null)
      setFollowUpPrompt(null)
      setNotice('This application was removed in another tab.')
      return
    }
    if (previous && JSON.stringify(current) !== JSON.stringify(previous)) {
      setEditor(null)
      setFollowUpPrompt(null)
      setNotice('This application changed in another tab. Open it again to edit the latest version.')
      return
    }
    const item = saveDetails(details, current)
    const items = current ? latest.items.map(existing => existing.id === item.id ? item : existing) : [...latest.items, item]
    const message = current ? 'Application updated.' : item.status === 'Interested' ? 'Opportunity saved.' : 'Application added.'
    if (!await persist({ ...latest, items }, message, item, item.id)) return
    if (!current) {
      setFilter('All')
      setKind('All')
      setQuery('')
    }
    setEditor(null)
    return item
  }

  async function markApplied(item: Application) {
    const applied = await save({ ...item, status: 'Applied', contactDate: item.contactDate || localDay() }, item)
    if (applied && !followUpDate(applied)) {
      setSaveError('')
      setPromptDate(null)
      setFollowUpPrompt(applied)
    }
  }

  async function scheduleAppliedFollowUp(date: string) {
    if (!followUpPrompt || (board && !rows)) return
    const current = loadLatest().items.find(item => item.id === followUpPrompt.id)
    if (!current || current.status !== 'Applied' || followUpDate(current)) {
      setFollowUpPrompt(null)
      setNotice('The application changed. Open its details to review the follow-up.')
      return
    }
    if (await save({ ...current, followUp: { mode: 'date', date } }, current)) {
      setFollowUpPrompt(null)
    }
  }

  function loadLatest() {
    if (board || storageError) return workspace
    try {
      return localStorage.getItem(storageKey) ? loadWorkspace() : workspace
    } catch {
      return workspace
    }
  }

  async function deleteApplication(item: Application) {
    const latest = loadLatest()
    const current = latest.items.find(entry => entry.id === item.id)
    if (!current || JSON.stringify(current) !== JSON.stringify(item)) {
      setEditor(null)
      setNotice(current ? 'This application changed in another tab. Open it again to delete it.' : 'This application was removed in another tab.')
      return
    }
    const items = latest.items.filter(entry => entry.id !== item.id)
    if (await persist({ ...latest, items }, 'Application deleted.', null, item.id)) setEditor(null)
  }

  async function clearBoard() {
    if (writing.current || (board && !rows)) return
    const empty = { items: [], exampleIds: [] }
    writing.current = true
    setClearing(true)
    setClearError('')
    try {
      if (board) {
        await board.clear()
        setRows(null)
        setReload(value => value + 1)
      } else {
        localStorage.setItem(storageKey, JSON.stringify(empty))
        setStorageError(false)
      }
      setWorkspace(empty)
      setFilter('All')
      setKind('All')
      setQuery('')
      setConfirmClear(false)
      setNotice('Application board cleared.')
    } catch {
      setClearError('Could not clear your board. Try again.')
    } finally {
      writing.current = false
      setClearing(false)
    }
  }

  async function markDone(item: Application, nextDate?: string) {
    const latest = loadLatest()
    const current = latest.items.find(entry => entry.id === item.id)
    if (!current || current.status !== item.status || JSON.stringify(current.followUp) !== JSON.stringify(item.followUp) || followUpDate(current) !== followUpDate(item) || followUpCount(current) !== followUpCount(item)) {
      setEditor(null)
      setNotice('This reminder changed in another tab. Open the application to see the latest reminder.')
      return
    }
    const updated = completeFollowUp(current, nextDate)
    const message = nextDate ? `Next follow-up for ${item.company} scheduled for ${formatDay(nextDate)}.` : `Follow-up completed for ${item.company}.`
    const items = latest.items.map(entry => entry.id === item.id ? updated : entry)
    if (await persist({ ...latest, items }, message, updated, item.id)) setEditor(null)
  }

  async function handleSignOut() {
    try {
      await signOut?.()
    } catch {
      setNotice('Could not sign out. Try again.')
    }
  }

  function saveBoardColumns(visible: Column[]) {
    setBoardColumns(visible)
    setDraftColumns(null)
    setFilter('All')
    try {
      localStorage.setItem(boardColumnsKey, JSON.stringify(visible))
    } catch {
      setNotice('Column settings were applied for this visit. Browser storage is unavailable.')
    }
  }

  const items = workspace.items
  const activeItems = items.filter(isActiveApplication)
  const pickerStatus = editor === 'pickInterview' ? 'Interview' : 'Completed'
  const pickerItems = editor === 'pickInterview' ? activeItems.filter(item => !item.interviewDone && !item.interview?.date) : activeItems
  const dueItems = items.filter(item => boardColumn(item, today) === 'Follow-up')
  const dueToday = dueItems.filter(item => followUpDate(item) === today).length
  const overdue = dueItems.length - dueToday
  const completedItems = items.filter(item => item.status === 'Completed')
  const completedOutcomes = outcomes.map(outcome => ({
    outcome,
    count: completedItems.filter(item => item.outcome === outcome).length,
  })).filter(({ count }) => count > 0)
  const summaries = [
    { title: 'Total opportunities', value: items.length, caption: 'Jobs and internships', icon: BriefcaseBusiness, tone: 'violet', filter: 'All' },
    { title: 'Active applications', value: activeItems.length, caption: 'Applications in progress', icon: ArrowUpRight, tone: 'blue', filter: 'Active' },
    { title: 'Follow-ups due', value: dueItems.length, caption: dueItems.length ? 'Due today or overdue' : 'You’re all caught up', icon: CalendarClock, tone: 'red', filter: 'Follow-up' },
    { title: 'Completed', value: completedItems.length, caption: 'Closed opportunities', icon: CircleCheck, tone: 'teal', filter: 'Completed' },
  ] as const
  const summaryBadges = {
    All: opportunityBadges(items),
    Active: opportunityBadges(activeItems),
    'Follow-up': [
      overdue > 0 && <span key="overdue" className="tag follow-up-overdue">{overdue} Overdue</span>,
      dueToday > 0 && <span key="today" className="tag tone-red">{dueToday} Due today</span>,
    ],
    Completed: completedOutcomes.map(({ outcome, count }) => <OutcomeBadge key={outcome} outcome={outcome} count={count} />),
  }
  const visibleColumns = filter === 'Active' ? columns.filter(column => column !== 'Interested' && column !== 'Completed')
    : filter === 'All' ? columns.filter(column => boardColumns.includes(column)) : [filter]
  const search = query.trim().toLocaleLowerCase()
  const matching = items.filter(item => {
    return (kind === 'All' || item.kind === kind)
      && `${item.company} ${item.position}`.toLocaleLowerCase().includes(search)
      && visibleColumns.includes(boardColumn(item, today))
  })

  return <>
    <header className="topbar">
      <div className="brand-group">
        <div className="brand"><span className="brand-icon"><Compass size={23} /></span>nextstep<span className="brand-dot">.</span></div>
        <span className="brand-tagline">Take your next step</span>
      </div>
      <button type="button" className="top-date" aria-haspopup="dialog" title="Open calendar" disabled={Boolean(board && !rows)} onClick={() => setCalendarDay(today)}>
        <CalendarDays size={16} />{new Date(`${today}T12:00:00`).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
      </button>
      {signOut && <button className="secondary" disabled={importing} onClick={handleSignOut} title={email}>Sign out</button>}
      {exitGuest && <button className="secondary" onClick={exitGuest}>Sign in</button>}
    </header>
    <main className="dashboard-page">
      {board && !rows ? <div role="status">
        {loadError ? <>Could not load your saved board. <button className="secondary" onClick={() => {
          setLoadError(false)
          setReload(value => value + 1)
        }}>Try again</button></> : 'Loading your saved board…'}
      </div> : <>
      <div className="dashboard-overview">
      {board && !importDismissed && importable.length > 0 && <section className="guest-import" aria-labelledby="guest-import-title">
        <div>
          <h2 id="guest-import-title">Import your guest board</h2>
          <p>{importable.length} {importable.length === 1 ? 'opportunity is' : 'opportunities are'} saved in this browser and can be copied to your account.</p>
          {importError && <p className="error" role="alert">{importError}</p>}
        </div>
        <div className="guest-import-actions">
          <button type="button" className="secondary" disabled={importing} onClick={() => setImportDismissed(true)}>Not now</button>
          <button type="button" className="primary" disabled={importing} onClick={importGuestBoard}>{importing ? 'Importing…' : 'Import applications'}</button>
        </div>
      </section>}
      <section className="summary-grid" aria-label="Application summary">
        {summaries.map(summary => <button className={`summary ${filter !== 'All' && filter === summary.filter ? 'selected' : ''}`} key={summary.title} aria-pressed={filter === summary.filter} onClick={() => setFilter(filter === summary.filter ? 'All' : summary.filter)}>
          <span className="summary-top"><span className={`metric-icon tone-${summary.tone}`}><summary.icon size={19} /></span><ArrowDownRight className="metric-arrow" size={16} /></span>
          <span className="metric-value">{summary.value}</span>
          <span className="metric-title">{summary.title}</span>
          <span className="metric-caption">{summary.caption}</span>
          {summaryBadges[summary.filter].some(Boolean) &&
            <span className="metric-badges">{summaryBadges[summary.filter]}</span>}
        </button>)}
      </section>
      <Calendar items={items} today={today} selected={calendarDay} setSelected={setCalendarDay} onOpen={item => setEditor({ item })} />
      </div>
      <section className="board-panel" aria-labelledby="board-title">
        <div className="board-toolbar">
          <div className="board-title"><span className="board-icon"><Columns3 size={19} /></span><div><h1 id="board-title">Application board</h1><p>{matching.length} {matching.length === 1 ? 'opportunity' : 'opportunities'}{filter !== 'All' && ` · ${filter}`}</p></div></div>
          <div className="filters">
            <button type="button" className="secondary" aria-haspopup="dialog" onClick={() => setDraftColumns(boardColumns)}>Edit board</button>
            {filter !== 'All' && <button className="secondary" onClick={() => setFilter('All')}><X size={15} /> Clear stage filter</button>}
            <label className="search"><Search size={17} /><input type="search" aria-label="Search applications" placeholder="Search applications…" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <select aria-label="Opportunity type filter" value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="All">All types</option><option>Job</option><option>Internship</option></select>
          </div>
        </div>
        <div className="board-scroll" role="region" aria-label="Kanban board" tabIndex={0}>
          <div className="board" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(175px, ${visibleColumns.length === 1 ? '280px' : '1fr'}))` }}>
            {visibleColumns.map(column => {
              const cards = matching.filter(item => boardColumn(item, today) === column)
              if (column === 'Follow-up') cards.sort((a, b) => (followUpDate(a) ?? '').localeCompare(followUpDate(b) ?? ''))
              if (column === 'Interested') cards.sort((a, b) => {
                const aDeadline = a.applicationDeadline || '9999-12-31'
                const bDeadline = b.applicationDeadline || '9999-12-31'
                return Number(aDeadline < today) - Number(bDeadline < today) || aDeadline.localeCompare(bDeadline)
              })
              const isStage = column !== 'Follow-up'
              return <section key={column} className={`lane lane-${colors[column]}`} aria-label={column}
                onDragOver={isStage ? event => {
                  if (!event.dataTransfer.types.includes(applicationDragType)) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                } : undefined}
                onDrop={isStage ? event => {
                  if (!event.dataTransfer.types.includes(applicationDragType)) return
                  event.preventDefault()
                  const item = items.find(item => item.id === event.dataTransfer.getData(applicationDragType))
                  if (!item) return
                  if (column === 'Interview' || (column === 'Completed' && item.status !== column)) {
                    setEditor({ item, status: column })
                  } else if (item.status !== column) {
                    void save({ ...item, status: column }, item)
                  }
                } : undefined}>
                <header className="lane-header">
                  <h3><span className="lane-dot" />{column}<span className="count">{cards.length}</span></h3>
                  {isStage && <button className="icon-button" aria-label={column === 'Interview' ? 'Add interview' : `Add to ${column}`} onClick={() => {
                    if (column === 'Interview') setEditor('pickInterview')
                    else if (column === 'Completed') setEditor('pickCompleted')
                    else setEditor({ status: column })
                  }}><Plus size={16} /></button>}
                </header>
                <div className="lane-cards">
                  {cards.map(item => <ApplicationCard key={item.id} item={item} today={today} onOpen={() => setEditor({ item })} onComplete={() => markDone(item)} />)}
                  {!cards.length && <div className="empty"><Inbox size={19} />{column === 'Follow-up' ? 'No reminders due' : 'No applications here'}</div>}
                </div>
              </section>
            })}
          </div>
        </div>
      </section>
      </>}
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button></div>}
      {storageError && <p className="error" role="alert">Browser storage is unavailable. Changes may be lost when you close or reload this page.</p>}
    </main>
    {draftColumns && <Modal titleId="edit-board-title" className="outcome-dialog" onClose={() => setDraftColumns(null)}>
      <header className="dialog-header"><h2 id="edit-board-title">Edit board</h2></header>
      <div className="dialog-body">
        <p>Choose which columns to show on your board. Keep at least one visible.</p>
        <fieldset className="board-column-options">
          <legend>Visible columns</legend>
          {columns.map(column => {
            const checked = draftColumns.includes(column)
            return <label key={column}>
              <input type="checkbox" checked={checked} disabled={checked && draftColumns.length === 1} onChange={event => {
                setDraftColumns(event.target.checked ? [...draftColumns, column] : draftColumns.filter(visible => visible !== column))
              }} />
              {column}
            </label>
          })}
        </fieldset>
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary delete-application clear-board-button" disabled={items.length === 0 || importing} onClick={() => {
          setDraftColumns(null)
          setClearError('')
          setConfirmClear(true)
        }}>Clear board</button>
        <button type="button" className="secondary" onClick={() => setDraftColumns(null)}>Cancel</button>
        <button type="button" className="primary" onClick={() => saveBoardColumns(draftColumns)}>Save layout</button>
      </footer>
    </Modal>}
    {confirmClear && <Modal titleId="clear-board-title" className="outcome-dialog" onClose={() => {
      if (!clearing) setConfirmClear(false)
    }}>
      <header className="dialog-header"><h2 id="clear-board-title">Clear application board?</h2></header>
      <div className="dialog-body">
        <p>This permanently deletes all {items.length} {items.length === 1 ? 'application' : 'applications'} on your {board ? 'account board across devices' : 'guest board in this browser'}, including hidden cards, notes, and history.</p>
        {clearError && <p className="error" role="alert">{clearError}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" disabled={clearing} onClick={() => setConfirmClear(false)}>Cancel</button>
        <button type="button" className="secondary clear-board-button" disabled={clearing} onClick={clearBoard}>{clearing ? 'Clearing…' : 'Clear board'}</button>
      </footer>
    </Modal>}
    {(editor === 'pickCompleted' || editor === 'pickInterview') && <Modal titleId="application-picker-title" className="outcome-dialog" onClose={() => setEditor(null)}>
      <header className="dialog-header"><h2 id="application-picker-title">{editor === 'pickInterview' ? 'Add interview' : 'Select an application'}</h2></header>
      <div className="dialog-body complete-picker">
        {editor === 'pickInterview' && pickerItems.length > 0 && <p>Choose the application this interview is for.</p>}
        {pickerItems.length ? <ul>
          {pickerItems.map(item => <li key={item.id}>
            <button type="button" className="secondary" onClick={() => {
              setSaveError('')
              setEditor({ item, status: pickerStatus })
            }}>
              <span>{item.company} · {item.position}</span>
            </button>
          </li>)}
        </ul> : <p>{editor === 'pickInterview' ? 'No active applications without a scheduled interview.' : 'No active applications to move to Completed.'}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={() => setEditor(null)}>Cancel</button>
      </footer>
    </Modal>}
    {editor && typeof editor !== 'string' && ('item' in editor && editor.finishInterview && !editor.status
      ? <Modal titleId="finish-interview-title" className="outcome-dialog" onClose={() => { setEditor(null); setSaveError('') }}>
        <form onSubmit={event => {
          event.preventDefault()
          if (interviewFollowUpDate) void save({
            ...editor.item, status: 'Awaiting response', followUp: { mode: 'date', date: interviewFollowUpDate },
          }, editor.item)
        }}>
          <header className="dialog-header"><h2 id="finish-interview-title">What's next step after the interview?</h2></header>
          <div className="dialog-body complete-picker">
            {interviewFollowUpDate === null ? <ul>
              <li><button type="button" className="secondary" onClick={() => setInterviewFollowUpDate(addDays(today, 7))}>Schedule a follow-up</button></li>
              <li><button type="button" className="secondary" disabled={Boolean(board && !rows)} onClick={() => save({ ...editor.item, status: 'Awaiting response' }, editor.item)}>Move to Awaiting response</button></li>
              <li><button type="button" className="secondary" onClick={() => setEditor({ ...editor, status: 'Interview' })}>Schedule next interview</button></li>
              <li><button type="button" className="secondary" onClick={() => setEditor({ ...editor, status: 'Completed' })}>Complete application</button></li>
            </ul> : <label>Follow-up date
              <input type="date" required min={today} max="9999-12-31" value={interviewFollowUpDate} onChange={event => setInterviewFollowUpDate(event.target.value)} />
            </label>}
            {saveError && <p className="error" role="alert">{saveError}</p>}
          </div>
          <footer className="dialog-footer">
            <button type="button" className="secondary" onClick={() => {
              setSaveError('')
              if (interviewFollowUpDate === null) setEditor({ item: editor.item })
              else setInterviewFollowUpDate(null)
            }}>Back</button>
            {interviewFollowUpDate !== null && <button type="submit" className="primary" disabled={Boolean(board && !rows)}>Schedule follow-up</button>}
          </footer>
        </form>
      </Modal>
      : 'item' in editor && editor.status === 'Completed'
      ? <OutcomeDialog item={editor.item} saveError={saveError} busy={Boolean(board && !rows)}
          onClose={() => { setEditor(null); setSaveError('') }}
          onSave={outcome => save({ ...editor.item, status: 'Completed', outcome, interviewDone: editor.finishInterview || editor.item.interviewDone }, editor.item)} />
      : 'item' in editor && editor.status === 'Interview'
      ? <InterviewDialog item={editor.item} saveError={saveError} busy={Boolean(board && !rows)} nextRound={editor.finishInterview}
          onClose={() => { setEditor(editor.finishInterview ? { item: editor.item, finishInterview: true } : null); setSaveError('') }}
          onSave={interview => save({ ...(editor.finishInterview ? archiveInterview(editor.item) : editor.item), status: 'Interview', interview }, editor.item)} />
      : <ApplicationDialog saveError={saveError} busy={Boolean(board && !rows)} initial={'item' in editor ? { ...editor.item, status: editor.status ?? editor.item.status } : blankDetails(editor.status)} item={'item' in editor ? editor.item : undefined} onClose={() => { setEditor(null); setSaveError('') }} onSave={details => save(details, 'item' in editor ? editor.item : undefined)} onMarkApplied={markApplied} onFinishInterview={item => {
        setSaveError('')
        setInterviewFollowUpDate(null)
        setEditor({ item, finishInterview: true })
      }} onComplete={markDone} onDelete={deleteApplication} />)}
    {followUpPrompt && <Modal titleId="applied-follow-up-title" className="outcome-dialog" onClose={() => {
      setFollowUpPrompt(null)
      setSaveError('')
    }}>
      <form onSubmit={event => {
        event.preventDefault()
        if (promptDate) void scheduleAppliedFollowUp(promptDate)
      }}>
        <header className="dialog-header"><h2 id="applied-follow-up-title">When would you like to follow up?</h2></header>
        <div className="dialog-body">
          <p>{followUpPrompt.company} was marked as applied.</p>
          {promptDate !== null && <label>Follow-up date<input type="date" required min={today} max="9999-12-31" value={promptDate} onChange={event => setPromptDate(event.target.value)} /></label>}
          {saveError && <p className="error" role="alert">{saveError}</p>}
        </div>
        <footer className="dialog-footer">
          <button type="button" className="secondary" onClick={() => { setFollowUpPrompt(null); setSaveError('') }}>Skip</button>
          {promptDate === null ? <>
            <button type="button" className="secondary" onClick={() => setPromptDate(addDays(today, 7))}>Pick a date</button>
            <button type="button" className="primary" disabled={Boolean(board && !rows)} onClick={() => scheduleAppliedFollowUp(addDays(today, 7))}>In 7 days</button>
          </> : <button type="submit" className="primary" disabled={Boolean(board && !rows)}>Schedule</button>}
        </footer>
      </form>
    </Modal>}
  </>
}

createRoot(document.getElementById('root')!).render(
  <Account>{(board, email, signOut, owner, exitGuest) => <App key={owner ?? 'local'} board={board} email={email} signOut={signOut} exitGuest={exitGuest} />}</Account>,
)
