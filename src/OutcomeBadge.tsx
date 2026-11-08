import type { Details } from './model'

export function OutcomeBadge({ outcome, count }: { outcome: NonNullable<Details['outcome']>; count?: number }) {
  return <span className={`tag outcome outcome-${outcome.toLowerCase().replace(' ', '-')}`}>{count !== undefined && `${count} `}{outcome}</span>
}
