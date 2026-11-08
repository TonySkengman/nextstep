export const statuses = ['Interested', 'Applied', 'In Contact', 'Interview', 'Awaiting decision', 'Completed'] as const
export const columns = ['Applied', 'Interested', 'Follow-up', 'In Contact', 'Interview', 'Awaiting decision', 'Completed'] as const
export const methods = ['Email', 'Company website', 'LinkedIn', 'Phone', 'In person', 'Other'] as const
export const outcomes = ['Accepted', 'Rejected', 'Withdrawn', 'No response'] as const

export type Status = typeof statuses[number]
export type Column = typeof columns[number]
export type Kind = 'Job' | 'Internship'
export type FollowUp = { mode: 'date'; date: string } | { mode: 'interval'; days: number }
export type Interview = { date: string; time: string; location: string; notes: string }
export type Details = {
  company: string
  position: string
  location?: string
  applicationDeadline?: string
  kind: Kind
  status: Status
  pinned?: boolean
  boardOrder?: Partial<Record<Column, string>>
  contactDate: string
  method: typeof methods[number] | ''
  notes: string
  decisionNote?: string
  postingUrl?: string
  recruiterName?: string
  recruiterPhone?: string
  recruiterEmail?: string
  recruiterLinkedIn?: string
  outcome?: typeof outcomes[number]
  followUp: FollowUp | null
  interview?: Interview
  interviewDone?: boolean
  pastInterviews?: Interview[]
}
export type Event = { id: string; time: string; description: string }
export type Application = Details & { id: string; history: Event[] }

export function localDay(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDay(date)
}

export function followUpDate(item: Pick<Details, 'contactDate' | 'followUp'>) {
  if (!item.followUp) return null
  if (item.followUp.mode === 'date') return item.followUp.date
  return item.contactDate ? addDays(item.contactDate, item.followUp.days) : null
}

export type CalendarEvent = {
  item: Application
  date: string
  kind: 'Follow-up' | 'Interview' | 'Deadline'
  time?: string
}

export function calendarEvents(items: Application[]) {
  const days = new Map<string, CalendarEvent[]>()
  function add(event: CalendarEvent) {
    const events = days.get(event.date) ?? []
    events.push(event)
    days.set(event.date, events)
  }

  for (const item of items) {
    if (item.status === 'Completed') continue
    if (item.status === 'Interested' && item.applicationDeadline) {
      add({ item, date: item.applicationDeadline, kind: 'Deadline' })
    }
    const due = followUpDate(item)
    if (due) add({ item, date: due, kind: 'Follow-up' })
    if (item.status === 'Interview' && !item.interviewDone && item.interview?.date) {
      add({ item, date: item.interview.date, kind: 'Interview', time: item.interview.time })
    }
  }
  for (const events of days.values()) {
    events.sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00') || a.item.company.localeCompare(b.item.company))
  }
  return days
}

const completedFollowUpPrefix = 'Completed follow-up due '

export function followUpCount(item: Application) {
  return item.history.filter(event => event.description.startsWith(completedFollowUpPrefix)).length
}

export function awaitingDecisionDays(item: Application, today: string) {
  if (item.status !== 'Awaiting decision') return null

  const activityDates = (item.pastInterviews ?? []).map(interview => interview.date)
  const stageDates: string[] = []
  for (const event of item.history) {
    const completedFollowUp = event.description.startsWith(completedFollowUpPrefix)
    const enteredStage = event.description === 'Added to Awaiting decision'
      || /^Moved from .+ to Awaiting decision$/.test(event.description)
    if (!completedFollowUp && !enteredStage) continue

    const time = new Date(event.time)
    if (Number.isNaN(time.getTime())) continue
    const day = localDay(time)
    if (completedFollowUp) activityDates.push(day)
    else stageDates.push(day)
  }

  const latestDay = (days: string[]) => days
    .filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today && Number.isFinite(Date.parse(day)))
    .sort().pop()
  const since = latestDay(activityDates) ?? latestDay(stageDates) ?? latestDay([item.contactDate])
  if (!since) return null

  return (Date.parse(today) - Date.parse(since)) / 86_400_000
}

export function boardColumn(item: Details, today: string): Column {
  const due = followUpDate(item)
  return item.status !== 'Completed' && due && due <= today ? 'Follow-up' : item.status
}

function orderKey(item: Application, column: Column) {
  const defaultOrder = column === 'Follow-up' ? followUpDate(item)
    : column === 'Interested' ? item.applicationDeadline
    : item.history.at(-1)?.time
  return item.boardOrder?.[column] ?? `${defaultOrder || '9999-99-99'}|${item.id}`
}

export function sortColumnCards(cards: Application[], column: Column) {
  return [...cards].sort((a, b) => {
    const pinOrder = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
    if (pinOrder) return pinOrder
    const first = orderKey(a, column)
    const second = orderKey(b, column)
    return first < second ? -1 : first > second ? 1 : 0
  })
}

// A key between neighbors lets each move save only the dragged card.
function keyBetween(lower: string, upper?: string) {
  let prefix = ''
  for (let index = 0; ; index++) {
    const low = lower.charCodeAt(index) || 32
    const high = upper?.charCodeAt(index) || 126
    if (high - low > 1) return prefix + String.fromCharCode(Math.floor((low + high) / 2))
    prefix += String.fromCharCode(low)
    if (low < high) upper = undefined
  }
}

export function orderCard(item: Application, cards: Application[], column: Column, beforeId: string | null) {
  const neighbors = sortColumnCards(cards.filter(card => card.id !== item.id), column)
  const target = neighbors.findIndex(card => card.id === beforeId)
  const group = neighbors.filter(card => Boolean(card.pinned) === Boolean(item.pinned))
  const previous = target < 0 ? group : neighbors.slice(0, target)
    .filter(card => Boolean(card.pinned) === Boolean(item.pinned))
  const lower = previous.at(-1)
  const upper = group[previous.length]
  const key = keyBetween(lower ? orderKey(lower, column) : '', upper ? orderKey(upper, column) : undefined)
  return { ...item.boardOrder, [column]: key + item.id }
}

export function withEvent(item: Application, description: string): Application {
  const event = { id: crypto.randomUUID(), time: new Date().toISOString(), description }
  return { ...item, history: [event, ...item.history] }
}

export function archiveInterview(item: Details): Details {
  return {
    ...item,
    interview: undefined,
    interviewDone: undefined,
    pastInterviews: item.interview ? [...(item.pastInterviews ?? []), item.interview] : item.pastInterviews,
  }
}

const legacyWaitingStatus = 'Awaiting response'

export function sameApplication(first: Application, second: Application) {
  const serialize = (item: Application) => JSON.stringify(item, (_key, value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  })
  return serialize(first) === serialize(second)
}

export function normalizeColumnName(name: string) {
  return name === legacyWaitingStatus ? 'Awaiting decision' : name
}

export function normalizeApplication(saved: Omit<Application, 'status'> & { status: Status | typeof legacyWaitingStatus }): Application {
  const status = saved.status === legacyWaitingStatus ? 'Awaiting decision' : saved.status
  const item = { ...saved, status }
  const history = item.history.map(event => {
    const added = /^Added to (.+)$/.exec(event.description)
    const moved = /^Moved from (.+) to (.+)$/.exec(event.description)
    if (added?.[1] === legacyWaitingStatus) return { ...event, description: 'Added to Awaiting decision' }
    if (moved && (moved[1] === legacyWaitingStatus || moved[2] === legacyWaitingStatus)) {
      return { ...event, description: `Moved from ${normalizeColumnName(moved[1])} to ${normalizeColumnName(moved[2])}` }
    }
    return event
  })
  return status === 'Interview' && item.interviewDone
    ? { ...item, ...archiveInterview(item), status: 'Awaiting decision', history }
    : { ...item, history }
}

export function saveDetails(details: Details, previous?: Application): Application {
  const outcome = details.status === 'Completed' ? details.outcome : undefined
  details = { ...details, outcome, decisionNote: details.decisionNote?.trim() || undefined }
  if (details.status === 'Awaiting decision' && previous?.status === 'Interview') {
    details = archiveInterview({ ...details, interview: details.interview ?? previous.interview })
  }
  if (details.status !== 'Interview' && !(details.status === 'Completed' && details.interviewDone)) {
    delete details.interview
    delete details.interviewDone
  }
  if (!previous) {
    let item = withEvent({ ...details, id: crypto.randomUUID(), history: [] }, `Added to ${details.status}`)
    if (outcome) item = withEvent(item, `Recorded outcome: ${outcome}`)
    if (details.interview) {
      item = withEvent(item, `Scheduled interview for ${formatDay(details.interview.date)}`)
    }
    const due = followUpDate(item)
    return due ? withEvent(item, `Scheduled follow-up for ${formatDay(due)}`) : item
  }

  let item = { ...details, id: previous.id, history: previous.history }
  const fields = ['company', 'position', 'location', 'applicationDeadline', 'kind', 'contactDate', 'method', 'notes', 'decisionNote',
    'postingUrl', 'recruiterName', 'recruiterPhone', 'recruiterEmail', 'recruiterLinkedIn'] as const
  if (fields.some(field => details[field] !== previous[field])) {
    item = withEvent(item, 'Updated application details')
  }
  if (details.status !== previous.status) {
    item = withEvent(item, `Moved from ${previous.status} to ${details.status}`)
  }
  if (outcome !== previous.outcome) {
    item = withEvent(item, outcome ? `Recorded outcome: ${outcome}` : 'Cleared outcome')
  }
  const archivedInterview = (details.pastInterviews?.length ?? 0) > (previous.pastInterviews?.length ?? 0)
  if (archivedInterview) {
    item = withEvent(item, 'Recorded previous interview')
  }
  if (details.interview && (archivedInterview || JSON.stringify(details.interview) !== JSON.stringify(previous.interview))) {
    item = withEvent(item, `${previous.interview && !archivedInterview ? 'Updated' : 'Scheduled'} interview for ${formatDay(details.interview.date)}`)
  } else if (!details.interview && previous.interview && !archivedInterview) {
    item = withEvent(item, 'Removed interview details')
  }
  if (details.interviewDone && !previous.interviewDone) {
    item = withEvent(item, 'Marked interview as done')
  }
  const nextDue = followUpDate(details)
  const previousDue = followUpDate(previous)
  if (nextDue !== previousDue || JSON.stringify(details.followUp) !== JSON.stringify(previous.followUp)) {
    if (nextDue) {
      item = withEvent(item, `${previousDue ? 'Rescheduled' : 'Scheduled'} follow-up for ${formatDay(nextDue)}`)
    } else {
      item = withEvent(item, 'Removed follow-up')
    }
  }
  return item
}

export function completeFollowUp(item: Application, nextDate?: string) {
  const due = followUpDate(item)
  const completed = due ? withEvent({ ...item, followUp: null }, `${completedFollowUpPrefix}${formatDay(due)}`) : item
  return nextDate
    ? withEvent({ ...completed, followUp: { mode: 'date', date: nextDate } }, `Scheduled follow-up for ${formatDay(nextDate)}`)
    : completed
}

export function formatDay(day: string, locale = 'en') {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${day}T12:00:00`))
}

export function blankDetails(status: Status = 'Interested'): Details {
  const today = localDay()
  const interested = status === 'Interested'
  return {
    company: '', position: '', kind: 'Job', status, contactDate: interested ? '' : today, method: '', notes: '',
    followUp: interested ? null : { mode: 'date', date: addDays(today, 7) },
  }
}
