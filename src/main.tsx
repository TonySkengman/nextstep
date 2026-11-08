import { ThemeToggle } from './ThemeToggle'
import { LanguageProvider, LanguageSelect, useLanguage } from './language'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, CalendarClock, Check, CircleCheck, Columns3, Compass, Inbox, MapPin, Pin, Plus, Search, X } from 'lucide-react'
import { Account } from './Account'
import type { AccountBoard, SavedApplication } from './supabase'
import { ApplicationDialog } from './ApplicationDialog'
import { Calendar } from './Calendar'
import { DecisionDialog } from './DecisionDialog'
import { InterviewDialog } from './InterviewDialog'
import { Modal } from './Modal'
import { OutcomeDialog } from './OutcomeDialog'
import { OutcomeBadge } from './OutcomeBadge'
import { addDays, archiveInterview, awaitingDecisionDays, blankDetails, boardColumn, columns, completeFollowUp, followUpCount, followUpDate, localDay, normalizeApplication, normalizeColumnName, orderCard, outcomes, sameApplication, saveDetails, sortColumnCards } from './model'
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
      const savedColumns = saved.filter((name): name is string => typeof name === 'string').map(normalizeColumnName)
      const visible = columns.filter(column => savedColumns.includes(column))
      if (visible.length) return current || visible.includes('Awaiting decision') ? visible : [...visible, 'Awaiting decision']
    }
  } catch {
    // Use the default layout if browser storage is unavailable.
  }
  return [...columns]
}

function isActiveApplication(item: Application) {
  return item.status !== 'Interested' && item.status !== 'Completed'
}

function opportunityBadges(items: Application[], t: ReturnType<typeof useLanguage>['t']) {
  return (['Job', 'Internship'] as const).map(kind => {
    const count = items.filter(item => item.kind === kind).length
    return count > 0 && <span key={kind} className={`tag ${kind.toLowerCase()}`}>{count} {t(count === 1 ? kind : `${kind}s`)}</span>
  })
}

const colors: Record<Column, string> = {
  Interested: 'slate', Applied: 'blue', 'Follow-up': 'red',
  'In Contact': 'violet', Interview: 'teal', 'Awaiting decision': 'amber', Completed: 'green',
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

function dropBefore(lane: HTMLElement, pointerY: number, dragged: Application) {
  const cards = lane.querySelectorAll<HTMLElement>('[data-card-id]')
  for (const card of cards) {
    if (card.dataset.cardId === dragged.id) continue
    const pinned = card.hasAttribute('data-pinned')
    if (dragged.pinned && !pinned) return card.dataset.cardId ?? null
    if (!dragged.pinned && pinned) continue
    const bounds = card.getBoundingClientRect()
    if (pointerY < bounds.top + bounds.height / 2) return card.dataset.cardId ?? null
  }
  return null
}

function ApplicationCard({ item, today, onOpen, onComplete, onTogglePin, onDrag, onDragEnd, dropBefore }: {
  item: Application; today: string; onOpen: () => void; onComplete: () => void; onTogglePin: () => void
  onDrag: () => void; onDragEnd: () => void; dropBefore: boolean
}) {
  const { t, formatDay } = useLanguage()
  const date = followUpDate(item)
  const due = boardColumn(item, today) === 'Follow-up'
  const followedUp = followUpCount(item)
  const waitingDays = due ? null : awaitingDecisionDays(item, today)
  const deadline = item.status === 'Interested' ? item.applicationDeadline ?? '' : ''
  const deadlineSoon = deadline >= today && deadline <= addDays(today, 3)
  const initials = item.company.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase()
  const avatarColor = ['violet', 'teal', 'blue', 'amber', 'green'][item.company.charCodeAt(0) % 5]
  return <article className={`application ${due ? 'application-due' : ''}`} data-card-id={item.id}
    data-pinned={item.pinned || undefined} data-drop-before={dropBefore || undefined} draggable onDragEnd={onDragEnd} onDragStart={event => {
    onDrag()
    event.dataTransfer.setData(applicationDragType, item.id)
    event.dataTransfer.effectAllowed = 'move'
  }}>
    <button className="card-open" onClick={onOpen} aria-label={t('Open {company}, {position}', { company: item.company, position: item.position })}>
      <span className="card-top">
        <span className="company-line"><span className={`avatar tone-${avatarColor}`}>{initials}</span><span>{item.company}</span></span>
      </span>
      <span className="position">{item.position}</span>
      <span className="card-tags">
        <span className={`tag ${item.kind === 'Job' ? 'job' : 'internship'}`}>{t(item.kind)}</span>
        {item.status === 'Completed' && item.outcome && <OutcomeBadge outcome={item.outcome} />}
      </span>
      {deadline && <span className={`contact-date${deadlineSoon ? ' deadline-soon' : ''}`}>
        <CalendarDays size={13} /> {deadline === today ? t('Apply today') : t('Apply by {date}', { date: formatDay(deadline) })}
      </span>}
      {item.location && <span className="contact-date"><MapPin size={13} className="shrink-0" /><span className="card-location">{item.location}</span></span>}
      {item.contactDate && <span className="contact-date"><CalendarDays size={13} /> {formatDay(item.contactDate)}</span>}
      {followedUp > 0 && <span className="contact-date"><Check size={13} /> {t(followedUp === 1 ? 'Followed up {count} time' : 'Followed up {count} times', { count: followedUp })}</span>}
      {waitingDays !== null && <span className="contact-date"><CalendarClock size={13} /> {t(
        waitingDays === 0 ? 'Waiting since today' : waitingDays === 1 ? 'Waiting 1 day' : 'Waiting {count} days',
        { count: waitingDays },
      )}</span>}
      {item.status === 'Awaiting decision' && item.decisionNote && <span className="decision-note">{item.decisionNote}</span>}
      {item.status === 'Interview' && (item.interviewDone
        ? <span className="contact-date"><Check size={13} /> {t('Interview done')}</span>
        : item.interview && <span className="contact-date"><CalendarClock size={13} /> {t('Interview {date}', { date: formatDay(item.interview.date) })}{item.interview.time && ` · ${item.interview.time}`}</span>)}
    </button>
    <button type="button" className="icon-button card-pin" aria-pressed={Boolean(item.pinned)}
      aria-label={t('Pin opportunity')} title={t(item.pinned ? 'Unpin opportunity' : 'Pin opportunity')}
      onClick={onTogglePin}>
      <Pin size={16} fill={item.pinned ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
    {date && item.status !== 'Completed' && <div className={`reminder ${due ? 'tone-red' : ''}`}>
      <div>
        <div className="flex items-center gap-1.5"><CalendarClock size={14} /> {due ? (date === today ? t('Due today') : t('Overdue')) : formatDay(date)}</div>
        {due && <span className="reminder-date">{formatDay(date)}</span>}
      </div>
      <button className="icon-button" aria-label={t('Complete follow-up for {company}', { company: item.company })} title={t('Mark follow-up done')} onClick={onComplete}><Check size={16} /></button>
    </div>}
  </article>
}

function App({ board, email, signOut, exitGuest }: {
  board?: AccountBoard; email?: string; signOut?: () => Promise<void>; exitGuest?: () => void
}) {
  const { t, formatDay, locale } = useLanguage()
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
  const draggedCard = useRef<Application | null>(null)
  const [dropTarget, setDropTarget] = useState<{ column: Column; beforeId: string | null } | null>(null)
  const [editor, setEditor] = useState<{ item: Application; status?: Status; finishInterview?: boolean; decisionFollowUpDate?: string; boardOrder?: Details['boardOrder'] } | { status: Status } | { draft: Details } | 'pickCompleted' | 'pickInterview' | 'pickAwaitingDecision' | null>(null)
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
    if (previous && current && !sameApplication(current, previous)) {
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

  async function togglePin(id: string) {
    const latest = loadLatest()
    const current = latest.items.find(item => item.id === id)
    if (!current) {
      setNotice('This application was removed in another tab.')
      return
    }
    const updated = { ...current, pinned: !current.pinned }
    const items = latest.items.map(item => item.id === id ? updated : item)
    await persist({ ...latest, items }, updated.pinned ? 'Opportunity pinned.' : 'Opportunity unpinned.', updated, id)
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
    if (!current || !sameApplication(current, item)) {
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
    const message = nextDate ? t('Next follow-up for {company} scheduled for {date}.', { company: item.company, date: formatDay(nextDate) }) : t('Follow-up completed for {company}.', { company: item.company })
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

  function moveToAwaitingDecision(item: Application, decisionFollowUpDate?: string, boardOrder?: Details['boardOrder']) {
    setSaveError('')
    setEditor({ item, status: 'Awaiting decision', decisionFollowUpDate, boardOrder })
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
  const pickerItems = activeItems.filter(item => {
    if (editor === 'pickInterview') return !item.interviewDone && !item.interview?.date
    if (editor === 'pickAwaitingDecision') return item.status !== 'Awaiting decision'
    return true
  })
  const dueItems = items.filter(item => boardColumn(item, today) === 'Follow-up')
  const dueToday = dueItems.filter(item => followUpDate(item) === today).length
  const overdue = dueItems.length - dueToday
  const completedItems = items.filter(item => item.status === 'Completed')
  const completedOutcomes = outcomes.map(outcome => ({
    outcome,
    count: completedItems.filter(item => item.outcome === outcome).length,
  })).filter(({ count }) => count > 0)
  const summaries = [
    { title: t('Total opportunities'), value: items.length, caption: t('Jobs and internships'), icon: BriefcaseBusiness, tone: 'violet', filter: 'All' },
    { title: t('Active applications'), value: activeItems.length, caption: t('Applications in progress'), icon: ArrowUpRight, tone: 'blue', filter: 'Active' },
    { title: t('Follow-ups due'), value: dueItems.length, caption: dueItems.length ? t('Due today or overdue') : t('You’re all caught up'), icon: CalendarClock, tone: 'red', filter: 'Follow-up' },
    { title: t('Completed'), value: completedItems.length, caption: t('Closed opportunities'), icon: CircleCheck, tone: 'teal', filter: 'Completed' },
  ] as const
  const summaryBadges = {
    All: opportunityBadges(items, t),
    Active: opportunityBadges(activeItems, t),
    'Follow-up': [
      overdue > 0 && <span key="overdue" className="tag follow-up-overdue">{overdue} {t('Overdue')}</span>,
      dueToday > 0 && <span key="today" className="tag tone-red">{dueToday} {t('Due today')}</span>,
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
        <span className="brand-tagline">{t('Take your next step')}</span>
      </div>
      <button type="button" className="top-date" aria-haspopup="dialog" title={t('Open calendar')} disabled={Boolean(board && !rows)} onClick={() => setCalendarDay(today)}>
        <CalendarDays size={16} />{new Date(`${today}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
      </button>
      <div className="topbar-actions">
        <ThemeToggle />
        <LanguageSelect />
        {signOut && <button className="secondary" disabled={importing} onClick={handleSignOut} title={email}>{t('Sign out')}</button>}
        {exitGuest && <button className="secondary" onClick={exitGuest}>{t('Sign in')}</button>}
      </div>
    </header>
    <main className="dashboard-page">
      {board && !rows ? <div role="status">
        {loadError ? <>{t('Could not load your saved board.')} <button className="secondary" onClick={() => {
          setLoadError(false)
          setReload(value => value + 1)
        }}>{t('Try again')}</button></> : t('Loading your saved board…')}
      </div> : <>
      <div className="dashboard-overview">
      {board && !importDismissed && importable.length > 0 && <section className="guest-import" aria-labelledby="guest-import-title">
        <div>
          <h2 id="guest-import-title">{t('Import your guest board')}</h2>
          <p>{t(importable.length === 1
            ? '{count} opportunity is saved in this browser and can be copied to your account.'
            : '{count} opportunities are saved in this browser and can be copied to your account.', { count: importable.length })}</p>
          {importError && <p className="error" role="alert">{t(importError)}</p>}
        </div>
        <div className="guest-import-actions">
          <button type="button" className="secondary" disabled={importing} onClick={() => setImportDismissed(true)}>{t('Not now')}</button>
          <button type="button" className="primary" disabled={importing} onClick={importGuestBoard}>{importing ? t('Importing…') : t('Import applications')}</button>
        </div>
      </section>}
      <section className="summary-grid" aria-label={t('Application summary')}>
        {summaries.map(summary => <button className={`summary ${filter !== 'All' && filter === summary.filter ? 'selected' : ''}`} key={summary.filter} aria-pressed={filter === summary.filter} onClick={() => setFilter(filter === summary.filter ? 'All' : summary.filter)}>
          <span className="summary-top"><span className={`metric-icon tone-${summary.tone}`}><summary.icon size={19} /></span><ArrowDownRight className="metric-arrow" size={16} /></span>
          <span className="metric-value">{summary.value}</span>
          <span className="metric-title">{summary.title}</span>
          <span className="metric-caption">{summary.caption}</span>
          {summaryBadges[summary.filter].some(Boolean) &&
            <span className="metric-badges">{summaryBadges[summary.filter]}</span>}
        </button>)}
      </section>
      <Calendar items={items} today={today} selected={calendarDay} setSelected={setCalendarDay} onOpen={item => setEditor({ item })} onSaveEvent={async (details, item, day) => {
        if (!await save(details, item)) return false
        setCalendarDay(day)
        return true
      }} />
      </div>
      <section className="board-panel" aria-labelledby="board-title">
        <div className="board-toolbar">
          <div className="board-title"><span className="board-icon"><Columns3 size={19} /></span><div><h1 id="board-title">{t('Application board')}</h1><p>{matching.length} {matching.length === 1 ? t('opportunity') : t('opportunities')}{filter !== 'All' && ` · ${t(filter)}`}</p></div></div>
          <div className="filters">
            <button type="button" className="secondary" aria-haspopup="dialog" onClick={() => setDraftColumns(boardColumns)}>{t('Edit board')}</button>
            {filter !== 'All' && <button className="secondary" onClick={() => setFilter('All')}><X size={15} /> {t('Clear stage filter')}</button>}
            <label className="search"><Search size={17} /><input type="search" aria-label={t('Search applications')} placeholder={t('Search applications…')} value={query} onChange={e => setQuery(e.target.value)} /></label>
            <select aria-label={t('Opportunity type filter')} value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="All">{t('All types')}</option><option value="Job">{t('Job')}</option><option value="Internship">{t('Internship')}</option></select>
          </div>
        </div>
        <div className="board-scroll" role="region" aria-label={t('Kanban board')} tabIndex={0}>
          <div className="board" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(175px, ${visibleColumns.length === 1 ? '280px' : '1fr'}))` }}>
            {visibleColumns.map(column => {
              const cards = sortColumnCards(matching.filter(item => boardColumn(item, today) === column), column)
              const isStage = column !== 'Follow-up'
              return <section key={column} className={`lane lane-${colors[column]}`} aria-label={t(column)}
                onDragOver={event => {
                  const item = draggedCard.current
                  if (!item || (!isStage && boardColumn(item, today) !== column)) return
                  if (!event.dataTransfer.types.includes(applicationDragType)) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  const beforeId = dropBefore(event.currentTarget, event.clientY, item)
                  setDropTarget(current => current?.column === column && current.beforeId === beforeId ? current : { column, beforeId })
                }}
                onDragLeave={event => {
                  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
                  setDropTarget(current => current?.column === column ? null : current)
                }}
                onDrop={event => {
                  if (!event.dataTransfer.types.includes(applicationDragType)) return
                  event.preventDefault()
                  setDropTarget(null)
                  const item = items.find(item => item.id === event.dataTransfer.getData(applicationDragType))
                  if (!item || (!isStage && boardColumn(item, today) !== column)) return
                  const beforeId = dropBefore(event.currentTarget, event.clientY, item)
                  if (boardColumn(item, today) === column) {
                    const latest = loadLatest()
                    const current = latest.items.find(card => card.id === item.id)
                    if (!current || boardColumn(current, today) !== column) return
                    const columnItems = latest.items.filter(card => boardColumn(card, today) === column)
                    const updated = { ...current, boardOrder: orderCard(current, columnItems, column, beforeId) }
                    const reordered = latest.items.map(card => card.id === item.id ? updated : card)
                    void persist({ ...latest, items: reordered }, 'Opportunity reordered.', updated, item.id)
                    return
                  }
                  if (column === 'Follow-up' || item.status === column) return
                  const columnItems = items.filter(card => boardColumn(card, today) === column)
                  const boardOrder = orderCard(item, columnItems, column, beforeId)
                  if (column === 'Interview' || column === 'Completed') {
                    setSaveError('')
                    setEditor({ item, status: column, boardOrder })
                  } else if (column === 'Awaiting decision') {
                    moveToAwaitingDecision(item, undefined, boardOrder)
                  } else {
                    void save({ ...item, status: column, boardOrder }, item)
                  }
                }}>
                <header className="lane-header">
                  <h3><span className="lane-dot" />{t(column)}<span className="count">{cards.length}</span></h3>
                  {isStage && <button className="icon-button" aria-label={column === 'Interview' ? t('Add interview') : t('Add to {column}', { column: t(column) })} onClick={() => {
                    if (column === 'Interview') setEditor('pickInterview')
                    else if (column === 'Completed') setEditor('pickCompleted')
                    else if (column === 'Awaiting decision') {
                      setSaveError('')
                      setEditor('pickAwaitingDecision')
                    }
                    else setEditor({ status: column })
                  }}><Plus size={16} /></button>}
                </header>
                <div className="lane-cards" data-drop-end={dropTarget?.column === column && dropTarget.beforeId === null || undefined}>
                  {cards.map(item => <ApplicationCard key={item.id} item={item} today={today} onOpen={() => setEditor({ item })}
                    onComplete={() => markDone(item)} onTogglePin={() => void togglePin(item.id)}
                    onDrag={() => { draggedCard.current = item }}
                    onDragEnd={() => { draggedCard.current = null; setDropTarget(null) }}
                    dropBefore={dropTarget?.column === column && dropTarget.beforeId === item.id} />)}
                  {!cards.length && <div className="empty"><Inbox size={19} />{column === 'Follow-up' ? t('No reminders due') : t('No applications here')}</div>}
                </div>
              </section>
            })}
          </div>
        </div>
      </section>
      </>}
      {notice && <div className="toast" role="status"><Check size={16} />{t(notice)}<button className="icon-button" aria-label={t('Dismiss message')} onClick={() => setNotice('')}><X size={16} /></button></div>}
      {storageError && <p className="error" role="alert">{t('Browser storage is unavailable. Changes may be lost when you close or reload this page.')}</p>}
    </main>
    {draftColumns && <Modal titleId="edit-board-title" className="outcome-dialog" onClose={() => setDraftColumns(null)}>
      <header className="dialog-header"><h2 id="edit-board-title">{t('Edit board')}</h2></header>
      <div className="dialog-body">
        <p>{t('Choose which columns to show on your board. Keep at least one visible.')}</p>
        <fieldset className="board-column-options">
          <legend>{t('Visible columns')}</legend>
          {columns.map(column => {
            const checked = draftColumns.includes(column)
            return <label key={column}>
              <input type="checkbox" checked={checked} disabled={checked && draftColumns.length === 1} onChange={event => {
                setDraftColumns(event.target.checked ? [...draftColumns, column] : draftColumns.filter(visible => visible !== column))
              }} />
              {t(column)}
            </label>
          })}
        </fieldset>
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary delete-application clear-board-button" disabled={items.length === 0 || importing} onClick={() => {
          setDraftColumns(null)
          setClearError('')
          setConfirmClear(true)
        }}>{t('Clear board')}</button>
        <button type="button" className="secondary" onClick={() => setDraftColumns(null)}>{t('Cancel')}</button>
        <button type="button" className="primary" onClick={() => saveBoardColumns(draftColumns)}>{t('Save layout')}</button>
      </footer>
    </Modal>}
    {confirmClear && <Modal titleId="clear-board-title" className="outcome-dialog" onClose={() => {
      if (!clearing) setConfirmClear(false)
    }}>
      <header className="dialog-header"><h2 id="clear-board-title">{t('Clear application board?')}</h2></header>
      <div className="dialog-body">
        <p>{t('This permanently deletes all {count} {applications} on your {board}, including hidden cards, notes, and history.', {
          count: items.length, applications: t(items.length === 1 ? 'application' : 'applications'),
          board: t(board ? 'account board across devices' : 'guest board in this browser'),
        })}</p>
        {clearError && <p className="error" role="alert">{t(clearError)}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" disabled={clearing} onClick={() => setConfirmClear(false)}>{t('Cancel')}</button>
        <button type="button" className="secondary clear-board-button" disabled={clearing} onClick={clearBoard}>{clearing ? t('Clearing…') : t('Clear board')}</button>
      </footer>
    </Modal>}
    {(editor === 'pickCompleted' || editor === 'pickInterview' || editor === 'pickAwaitingDecision') && <Modal titleId="application-picker-title" className="outcome-dialog" onClose={() => setEditor(null)}>
      <header className="dialog-header"><h2 id="application-picker-title">{editor === 'pickInterview' ? t('Add interview') : t('Select an application')}</h2></header>
      <div className="dialog-body complete-picker">
        {editor === 'pickInterview' && pickerItems.length > 0 && <p>{t('Choose the application this interview is for.')}</p>}
        {editor === 'pickAwaitingDecision' && pickerItems.length > 0 && <p>{t('Choose an application with a completed interview or assessment.')}</p>}
        {pickerItems.length ? <ul>
          {pickerItems.map(item => <li key={item.id}>
            <button type="button" className="secondary" disabled={editor === 'pickAwaitingDecision' && Boolean(board && !rows)} onClick={() => {
              setSaveError('')
              if (editor === 'pickAwaitingDecision') moveToAwaitingDecision(item)
              else setEditor({ item, status: editor === 'pickInterview' ? 'Interview' : 'Completed' })
            }}>
              <span>{item.company} · {item.position}</span>
            </button>
          </li>)}
        </ul> : <p>{editor === 'pickInterview' ? t('No active applications without a scheduled interview.')
          : editor === 'pickAwaitingDecision' ? t('No active applications to move to Awaiting decision.')
          : t('No active applications to move to Completed.')}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={() => setEditor(null)}>{t('Cancel')}</button>
      </footer>
    </Modal>}
    {editor && typeof editor !== 'string' && ('item' in editor && editor.finishInterview && !editor.status
      ? <Modal titleId="finish-interview-title" className="outcome-dialog" onClose={() => { setEditor(null); setSaveError('') }}>
        <form onSubmit={event => {
          event.preventDefault()
          if (interviewFollowUpDate) moveToAwaitingDecision(editor.item, interviewFollowUpDate)
        }}>
          <header className="dialog-header"><h2 id="finish-interview-title">{t("What's next step after the interview?")}</h2></header>
          <div className="dialog-body complete-picker">
            {interviewFollowUpDate === null ? <ul>
              <li><button type="button" className="secondary" onClick={() => setInterviewFollowUpDate(addDays(today, 7))}>{t('Schedule a follow-up')}</button></li>
              <li><button type="button" className="secondary" onClick={() => moveToAwaitingDecision(editor.item)}>{t('Move to Awaiting decision')}</button></li>
              <li><button type="button" className="secondary" onClick={() => setEditor({ ...editor, status: 'Interview' })}>{t('Schedule next interview')}</button></li>
              <li><button type="button" className="secondary" onClick={() => setEditor({ ...editor, status: 'Completed' })}>{t('Complete application')}</button></li>
            </ul> : <label>{t('Follow-up date')}
              <input type="date" required min={today} max="9999-12-31" value={interviewFollowUpDate} onChange={event => setInterviewFollowUpDate(event.target.value)} />
            </label>}
            {saveError && <p className="error" role="alert">{t(saveError)}</p>}
          </div>
          <footer className="dialog-footer">
            <button type="button" className="secondary" onClick={() => {
              setSaveError('')
              if (interviewFollowUpDate === null) setEditor({ item: editor.item })
              else setInterviewFollowUpDate(null)
            }}>{t('Back')}</button>
            {interviewFollowUpDate !== null && <button type="submit" className="primary" disabled={Boolean(board && !rows)}>{t('Continue')}</button>}
          </footer>
        </form>
      </Modal>
      : 'item' in editor && editor.status === 'Awaiting decision'
      ? <DecisionDialog item={editor.item} saveError={saveError} busy={Boolean(board && !rows)}
          onClose={() => { setEditor(null); setSaveError('') }}
          onSave={note => save({
            ...editor.item,
            status: 'Awaiting decision',
            decisionNote: note,
            boardOrder: editor.boardOrder ?? editor.item.boardOrder,
            followUp: editor.decisionFollowUpDate
              ? { mode: 'date', date: editor.decisionFollowUpDate }
              : editor.item.followUp,
          }, editor.item)} />
      : 'item' in editor && editor.status === 'Completed'
      ? <OutcomeDialog item={editor.item} saveError={saveError} busy={Boolean(board && !rows)}
          onClose={() => { setEditor(null); setSaveError('') }}
          onSave={outcome => save({ ...editor.item, status: 'Completed', outcome, boardOrder: editor.boardOrder ?? editor.item.boardOrder, interviewDone: editor.finishInterview || editor.item.interviewDone }, editor.item)} />
      : 'item' in editor && editor.status === 'Interview'
      ? <InterviewDialog item={editor.item} saveError={saveError} busy={Boolean(board && !rows)} nextRound={editor.finishInterview}
          onClose={() => { setEditor(editor.finishInterview ? { item: editor.item, finishInterview: true } : null); setSaveError('') }}
          onSave={interview => save({ ...(editor.finishInterview ? archiveInterview(editor.item) : editor.item), status: 'Interview', interview, boardOrder: editor.boardOrder ?? editor.item.boardOrder }, editor.item)} />
      : <ApplicationDialog key={'draft' in editor ? 'duplicate' : 'item' in editor ? editor.item.id : 'new'}
          saveError={saveError} busy={Boolean(board && !rows)}
          initial={'draft' in editor ? editor.draft : 'item' in editor ? { ...editor.item, status: editor.status ?? editor.item.status } : blankDetails(editor.status)}
          item={'item' in editor ? editor.item : undefined} onClose={() => { setEditor(null); setSaveError('') }} onSave={details => save(details, 'item' in editor ? editor.item : undefined)} onMarkApplied={markApplied} onFinishInterview={item => {
        setSaveError('')
        setInterviewFollowUpDate(null)
        setEditor({ item, finishInterview: true })
      }} onComplete={markDone} onDuplicate={item => {
        setSaveError('')
        const { company, location, kind, recruiterName, recruiterLinkedIn, recruiterEmail, recruiterPhone } = item
        setEditor({ draft: {
          ...blankDetails('Interested'),
          company, location, kind, recruiterName, recruiterLinkedIn, recruiterEmail, recruiterPhone,
        } })
      }} onDelete={deleteApplication} />)}
    {followUpPrompt && <Modal titleId="applied-follow-up-title" className="outcome-dialog" onClose={() => {
      setFollowUpPrompt(null)
      setSaveError('')
    }}>
      <form onSubmit={event => {
        event.preventDefault()
        if (promptDate) void scheduleAppliedFollowUp(promptDate)
      }}>
        <header className="dialog-header"><h2 id="applied-follow-up-title">{t('When would you like to follow up?')}</h2></header>
        <div className="dialog-body">
          <p>{t('{company} was marked as applied.', { company: followUpPrompt.company })}</p>
          {promptDate !== null && <label>{t('Follow-up date')}<input type="date" required min={today} max="9999-12-31" value={promptDate} onChange={event => setPromptDate(event.target.value)} /></label>}
          {saveError && <p className="error" role="alert">{t(saveError)}</p>}
        </div>
        <footer className="dialog-footer">
          <button type="button" className="secondary" onClick={() => { setFollowUpPrompt(null); setSaveError('') }}>{t('Skip')}</button>
          {promptDate === null ? <>
            <button type="button" className="secondary" onClick={() => setPromptDate(addDays(today, 7))}>{t('Pick a date')}</button>
            <button type="button" className="primary" disabled={Boolean(board && !rows)} onClick={() => scheduleAppliedFollowUp(addDays(today, 7))}>{t('In 7 days')}</button>
          </> : <button type="submit" className="primary" disabled={Boolean(board && !rows)}>{t('Schedule')}</button>}
        </footer>
      </form>
    </Modal>}
  </>
}

createRoot(document.getElementById('root')!).render(
  <LanguageProvider><Account>{(board, email, signOut, owner, exitGuest) => <App key={owner ?? 'local'} board={board} email={email} signOut={signOut} exitGuest={exitGuest} />}</Account></LanguageProvider>,
)
