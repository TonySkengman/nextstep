import { useState } from 'react'
import { Modal } from './Modal'
import { outcomes } from './model'
import type { Application } from './model'

export function OutcomeDialog({ item, saveError, busy, onClose, onSave }: {
  item: Application
  saveError: string
  busy: boolean
  onClose: () => void
  onSave: (outcome: Application['outcome']) => void
}) {
  const [outcome, setOutcome] = useState<Application['outcome']>()

  return <Modal titleId="outcome-title" className="outcome-dialog" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); onSave(outcome) }}>
      <header className="dialog-header"><h2 id="outcome-title">Select an outcome</h2></header>
      <div className="dialog-body">
        <p>{item.position} at {item.company}</p>
        <label>Outcome
          <select autoFocus value={outcome ?? ''} onChange={event => setOutcome(outcomes.find(value => value === event.target.value))}>
            <option value="">No outcome selected</option>
            {outcomes.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        {saveError && <p className="error" role="alert">{saveError}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="primary" disabled={busy}>Move to Completed</button>
      </footer>
    </form>
  </Modal>
}
