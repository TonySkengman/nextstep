import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function Modal({ titleId, className, onClose, children }: {
  titleId: string
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className={className} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onPointerDown={event => { pressedBackdrop.current = event.target === event.currentTarget }}
    onClick={event => {
      if (pressedBackdrop.current && event.target === event.currentTarget) onClose()
      pressedBackdrop.current = false
    }}>
    {children}
  </dialog>
}
