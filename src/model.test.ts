import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blankDetails, boardColumn, calendarEvents, completeFollowUp, followUpDate, localDay, saveDetails } from './model.ts'

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
  assert.match(completed.history[0].description, /^Completed follow-up/)
  assert.equal(completeFollowUp(completed), completed)
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
