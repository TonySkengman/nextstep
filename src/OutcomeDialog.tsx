import { useLanguage } from './language'
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
  const { t } = useLanguage()
  const [outcome, setOutcome] = useState<Application['outcome']>()

  return <Modal titleId="outcome-title" className="outcome-dialog" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); onSave(outcome) }}>
      <header className="dialog-header"><h2 id="outcome-title">{t('Select an outcome')}</h2></header>
      <div className="dialog-body">
        <p>{t('{position} at {company}', { position: item.position, company: item.company })}</p>
        <label>{t('Outcome')}
          <select autoFocus value={outcome ?? ''} onChange={event => setOutcome(outcomes.find(value => value === event.target.value))}>
            <option value="">{t('No outcome selected')}</option>
            {outcomes.map(value => <option key={value} value={value}>{t(value)}</option>)}
          </select>
        </label>
        {saveError && <p className="error" role="alert">{t(saveError)}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary" onClick={onClose}>{t('Cancel')}</button>
        <button type="submit" className="primary" disabled={busy}>{t('Move to Completed')}</button>
      </footer>
    </form>
  </Modal>
}
