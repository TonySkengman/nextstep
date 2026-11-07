export const statuses = ['Interested', 'Applied', 'In Contact', 'Interview', 'Completed'] as const
export const columns = ['Interested', 'Applied', 'Follow Up', 'In Contact', 'Interview', 'Completed'] as const
export const methods = ['Email', 'Company website', 'LinkedIn', 'Phone', 'In person', 'Other'] as const

export type Status = typeof statuses[number]
export type Column = typeof columns[number]
export type Kind = 'Job' | 'Internship'
export type FollowUp = { mode: 'date'; date: string } | { mode: 'interval'; days: number }
export type Details = {
  company: string
  position: string
  kind: Kind
  status: Status
  contactDate: string
  method: typeof methods[number] | ''
  notes: string
  followUp: FollowUp | null
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

export function boardColumn(item: Details, today: string): Column {
  const due = followUpDate(item)
  return item.status !== 'Completed' && due && due <= today ? 'Follow Up' : item.status
}

export function withEvent(item: Application, description: string): Application {
  const event = { id: crypto.randomUUID(), time: new Date().toISOString(), description }
  return { ...item, history: [event, ...item.history] }
}

export function saveDetails(details: Details, previous?: Application): Application {
  if (!previous) {
    const item = withEvent({ ...details, id: crypto.randomUUID(), history: [] }, `Added to ${details.status}`)
    const due = followUpDate(item)
    return due ? withEvent(item, `Scheduled follow-up for ${formatDay(due)}`) : item
  }

  let item = { ...details, id: previous.id, history: previous.history }
  const fields = ['company', 'position', 'kind', 'contactDate', 'method', 'notes'] as const
  if (fields.some(field => details[field] !== previous[field])) {
    item = withEvent(item, 'Updated application details')
  }
  if (details.status !== previous.status) {
    item = withEvent(item, `Moved from ${previous.status} to ${details.status}`)
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

export function completeFollowUp(item: Application) {
  const due = followUpDate(item)
  return due ? withEvent({ ...item, followUp: null }, `Completed follow-up due ${formatDay(due)}`) : item
}

export function formatDay(day: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${day}T12:00:00`))
}

export function blankDetails(status: Status = 'Interested'): Details {
  return { company: '', position: '', kind: 'Job', status, contactDate: '', method: '', notes: '', followUp: null }
}
