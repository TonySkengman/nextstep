import type { Details } from './model'

export function OutcomeBadge({ outcome }: { outcome: NonNullable<Details['outcome']> }) {
  return <span className={`tag outcome outcome-${outcome.toLowerCase().replace(' ', '-')}`}>{outcome}</span>
}
