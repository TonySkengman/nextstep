import { createClient } from '@supabase/supabase-js'
import type { Application } from './model'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null

type Row = { id: string; data: Application; version: string }

export function accountBoard(client: NonNullable<typeof supabase>, owner: string) {
  const table = () => client.from('applications')
  async function read() {
    const { data, error } = await table().select('id,data,version').eq('owner_id', owner).order('id')
    if (error) throw error
    return data as Row[]
  }

  async function write(next: Application | null, previous: Row | undefined) {
    if (!previous && next) {
      const { error } = await table().insert({ owner_id: owner, id: next.id, data: next })
      if (error) throw error
      return
    }
    if (!previous) return

    const operation = next
      ? table().update({ data: next, version: crypto.randomUUID() })
      : table().delete()
    const { data, error } = await operation.eq('owner_id', owner).eq('id', previous.id)
      .eq('version', previous.version).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('This application changed elsewhere. Reopen it and try again.')
  }

  return { read, write }
}

export type AccountBoard = ReturnType<typeof accountBoard>
export type SavedApplication = Row
