import { useLanguage } from './language'
import type { Details } from './model'

export function OutcomeBadge({ outcome, count }: { outcome: NonNullable<Details['outcome']>; count?: number }) {
  const { t } = useLanguage()
  return <span className={`tag outcome outcome-${outcome.toLowerCase().replace(' ', '-')}`}>{count !== undefined && `${count} `}{t(outcome)}</span>
}
