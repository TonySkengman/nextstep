import assert from 'node:assert/strict'
import { test } from 'node:test'
import { archiveInterview, awaitingResponseDays, blankDetails, boardColumn, calendarEvents, completeFollowUp, followUpCount, followUpDate, localDay, normalizeApplication, saveDetails } from './model.ts'

test('waiting time uses the latest interview or completed follow-up and ignores scheduled reminders', () => {
  const item = {
    ...blankDetails('Awaiting response'),
    id: 'waiting',
    contactDate: '2026-10-20',
    pastInterviews: [{ date: '2026-10-24', time: '', location: '', notes: '' }],
    followUp: { mode: 'date' as const, date: '2026-11-01' },
    history: [
      { id: 'follow-up', time: new Date('2026-10-29T12:00:00').toISOString(), description: 'Completed follow-up due 26 Oct 2026' },
      { id: 'stage', time: new Date('2026-10-27T12:00:00').toISOString(), description: 'Moved from Interview to Awaiting response' },
    ],
  }
  assert.equal(awaitingResponseDays(item, '2026-11-01'), 3)
  assert.equal(awaitingResponseDays({ ...item, history: item.history.slice(1) }, '2026-11-01'), 8)
  assert.equal(awaitingResponseDays({ ...item, history: item.history.slice(1), pastInterviews: [] }, '2026-11-01'), 5)
  assert.equal(awaitingResponseDays({ ...item, status: 'In Contact' }, '2026-11-01'), null)
})

test('an interval rolls across a month and surfaces once it is due', () => {
  const item = saveDetails({
    ...blankDetails('Applied'),
    contactDate: '2026-10-31',
    followUp: { mode: 'interval', days: 7 },
  })
  assert.equal(followUpDate(item), '2026-11-07')
  assert.equal(boardColumn(item, '2026-11-06'), 'Applied')
  assert.equal(boardColumn(item, '2026-11-07'), 'Follow-up')
  assert.equal(boardColumn(item, '2026-11-08'), 'Follow-up')
  assert.equal(item.status, 'Applied')
})

test('rescheduling and completing preserve the recruitment stage and record history', () => {
  const item = saveDetails({
    ...blankDetails('In Contact'),
    followUp: { mode: 'date', date: '2026-11-07' },
  })
  const updated = saveDetails({ ...item, followUp: { mode: 'date', date: '2026-11-10' } }, item)
  assert.equal(boardColumn(updated, '2026-11-07'), 'In Contact')
  assert.match(updated.history[0].description, /^Rescheduled/)
  assert.equal(boardColumn(updated, '2026-11-10'), 'Follow-up')

  const completed = completeFollowUp(updated)
  assert.equal(completed.followUp, null)
  assert.equal(boardColumn(completed, '2026-11-11'), 'In Contact')
  assert.equal(completed.status, 'In Contact')
  assert.equal(followUpCount(completed), 1)
  assert.match(completed.history[0].description, /^Completed follow-up/)
  assert.equal(completeFollowUp(completed), completed)
})

test('scheduling the next follow-up records the current one and returns the card to Follow-up when due', () => {
  const item = saveDetails({ ...blankDetails('Applied'), followUp: null })
  const scheduled = completeFollowUp(item, '2026-11-07')
  assert.equal(followUpCount(scheduled), 0)

  const followedUp = completeFollowUp(scheduled, '2026-11-14')
  assert.equal(followUpCount(followedUp), 1)
  assert.equal(followUpDate(followedUp), '2026-11-14')
  assert.equal(boardColumn(followedUp, '2026-11-13'), 'Applied')
  assert.equal(boardColumn(followedUp, '2026-11-14'), 'Follow-up')
  assert.equal(followUpCount(completeFollowUp(followedUp)), 2)
})

test('completed applications stay in Completed when a reminder date passes', () => {
  const item = { ...blankDetails('Completed'), followUp: { mode: 'date' as const, date: '2026-11-07' } }
  assert.equal(boardColumn(item, '2026-11-08'), 'Completed')
})

test('today follows the browser calendar day', () => {
  assert.equal(localDay(new Date(2026, 0, 2, 0, 5)), '2026-01-02')
})

test('the calendar groups scheduled interviews and follow-ups by date', () => {
  const item = saveDetails({
    ...blankDetails('Interview'),
    contactDate: '2026-11-08',
    followUp: { mode: 'interval', days: 3 },
    interview: { date: '2026-11-11', time: '14:00', location: '', notes: '' },
  })
  const completed = { ...item, id: 'completed', status: 'Completed' as const }
  const events = calendarEvents([item, completed]).get('2026-11-11')
  assert.deepEqual(events?.map(event => [event.item.id, event.kind, event.time]), [
    [item.id, 'Interview', '14:00'],
    [item.id, 'Follow-up', undefined],
  ])
})

test('application deadlines appear in the calendar only while interested', () => {
  const item = saveDetails({ ...blankDetails('Interested'), applicationDeadline: '2026-11-11' })
  assert.deepEqual(calendarEvents([item]).get('2026-11-11'), [
    { item, date: '2026-11-11', kind: 'Deadline' },
  ])
  for (const status of ['Applied', 'Completed'] as const) {
    assert.equal(calendarEvents([{ ...item, status }]).has('2026-11-11'), false)
  }
})

test('a finished interview keeps its details and shows only the new follow-up on the calendar', () => {
  const interview = { date: '2026-11-11', time: '14:00', location: '', notes: 'Discussed next steps' }
  const item = saveDetails({ ...blankDetails('Interview'), interview, followUp: null })
  const done = saveDetails({
    ...item, interviewDone: true, followUp: { mode: 'date', date: '2026-11-18' },
  }, item)

  assert.deepEqual(done.interview, interview)
  assert.ok(done.history.some(event => event.description === 'Marked interview as done'))
  assert.equal(calendarEvents([done]).has(interview.date), false)
  assert.equal(calendarEvents([done]).get('2026-11-18')?.[0]?.kind, 'Follow-up')
  assert.equal(boardColumn(done, '2026-11-18'), 'Follow-up')
  assert.deepEqual(saveDetails({ ...done, status: 'Completed' }, done).interview, interview)
})

test('interview next steps preserve previous rounds and schedule only the next event', () => {
  const first = { date: '2026-11-11', time: '14:00', location: '', notes: 'Screening' }
  const second = { ...first, date: '2026-11-18', notes: 'Technical interview' }
  const item = saveDetails({ ...blankDetails('Interview'), interview: first, followUp: null })
  const next = saveDetails({ ...archiveInterview(item), interview: second }, item)
  assert.deepEqual(next.pastInterviews, [first])
  assert.deepEqual([...calendarEvents([next]).keys()], [second.date])

  const contacted = saveDetails({
    ...next, status: 'Awaiting response', followUp: { mode: 'date', date: '2026-11-25' },
  }, next)
  assert.deepEqual(contacted.pastInterviews, [first, second])
  assert.equal(boardColumn(contacted, '2026-11-24'), 'Awaiting response')
  assert.equal(boardColumn(contacted, '2026-11-25'), 'Follow-up')
  assert.equal(boardColumn(completeFollowUp(contacted), '2026-11-25'), 'Awaiting response')

  const legacy = normalizeApplication({ ...next, interviewDone: true })
  assert.deepEqual(legacy.pastInterviews, [first, second])
  assert.equal(legacy.status, 'Awaiting response')
})

test('moving an existing application to Interview saves its interview and keeps its application details', () => {
  const item = saveDetails({
    ...blankDetails('Applied'),
    company: 'Example Company',
    position: 'Java Developer Intern',
    contactDate: '2026-11-08',
    notes: 'Applied by email',
    followUp: { mode: 'date', date: '2026-11-12' },
  })
  const interview = { date: '2026-11-10', time: '14:00', location: 'Main office', notes: 'Bring portfolio' }
  const updated = saveDetails({ ...item, status: 'Interview', interview }, item)
  assert.equal(boardColumn(updated, '2026-11-08'), 'Interview')
  assert.deepEqual(updated.interview, interview)
  const { status, interview: savedInterview, history, ...applicationDetails } = updated
  const { status: previousStatus, history: previousHistory, ...previousDetails } = item
  assert.deepEqual(applicationDetails, previousDetails)
  assert.match(history[0].description, /^Scheduled interview/)
})

test('moving an application back to Applied removes the interview and keeps its follow-up', () => {
  const item = saveDetails({
    ...blankDetails('Interview'),
    interview: { date: '2026-11-10', time: '14:00', location: 'Main office', notes: 'Bring portfolio' },
    followUp: { mode: 'date', date: '2026-11-12' },
  })
  const updated = saveDetails({ ...item, status: 'Applied' }, item)
  assert.equal(updated.interview, undefined)
  assert.equal(calendarEvents([updated]).has('2026-11-10'), false)
  assert.equal(followUpDate(updated), '2026-11-12')
  assert.ok(updated.history.some(event => event.description === 'Removed interview details'))
})
