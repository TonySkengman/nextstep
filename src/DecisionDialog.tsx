import { useState } from 'react'
import { useLanguage } from './language'
import { Modal } from './Modal'
import type { Application } from './model'

export function DecisionDialog({ item, saveError, busy, onClose, onSave }: {
  item: Application
  saveError: string
  busy: boolean
  onClose: () => void
  onSave: (note?: string) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(note?: string) {
    if (saving || busy) return
    setSaving(true)
    try {
      await onSave(note)
    } finally {
      setSaving(false)
    }
  }

  return <Modal titleId="decision-note-title" className="decision-dialog" onClose={() => {
    if (!saving) onClose()
  }}>
    <form onSubmit={event => {
      event.preventDefault()
      void submit(note.trim())
    }}>
      <header className="dialog-header"><h2 id="decision-note-title">{t('Move to Awaiting decision')}</h2></header>
      <div className="dialog-body">
        <p>{item.company} · {item.position}</p>
        <label>{t('Decision note (optional)')}
          <textarea rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)}
            placeholder={t('e.g. They said they’d call on Friday.')} disabled={saving} />
        </label>
        {saveError && <p role="alert" className="error">{t(saveError)}</p>}
      </div>
      <footer className="dialog-footer">
        <button type="button" className="secondary decision-cancel" disabled={saving} onClick={onClose}>{t('Cancel')}</button>
        <button type="button" className="secondary" disabled={busy || saving} onClick={() => void submit()}>{t('Skip note and move')}</button>
        <button type="submit" className="primary" disabled={!note.trim() || busy || saving}>{t('Save note and move')}</button>
      </footer>
    </form>
  </Modal>
}
