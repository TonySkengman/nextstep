import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blankDetails, boardColumn, completeFollowUp, followUpDate, localDay, saveDetails } from './model.ts'

test('an interval rolls across a month and surfaces once it is due', () => {
  const item = saveDetails({
    ...blankDetails('Applied'),
    contactDate: '2026-10-31',
    followUp: { mode: 'interval', days: 7 },
  })
  assert.equal(followUpDate(item), '2026-11-07')
  assert.equal(boardColumn(item, '2026-11-06'), 'Applied')
  assert.equal(boardColumn(item, '2026-11-07'), 'Follow Up')
  assert.equal(boardColumn(item, '2026-11-08'), 'Follow Up')
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
  assert.equal(boardColumn(updated, '2026-11-10'), 'Follow Up')

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
