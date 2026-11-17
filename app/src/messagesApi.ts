// Network side of the admin "Messages" view (story V2-15). Same pattern as ./adminApi for the V2-05
// RPCs: the signed-in admin's session calls the security definer RPCs from migration
// 20261117000000_v2_15_contact_messages.sql, which check the admins table again on the server.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './auth'
import { DEMO_ADMIN } from './demo'
import { MESSAGES_LOAD_FAILED, MESSAGES_NOT_ALLOWED, parseMessages, type ContactMessage } from './messagesLogic'

/** rpc admin_contact_list: newest first, at most 200. Throws one of the two fixed texts. */
export async function loadMessages(): Promise<ContactMessage[]> {
  // import.meta.env.DEV is a build-time constant: the demo chunk is dropped from production.
  if (import.meta.env.DEV && DEMO_ADMIN) {
    const { demoMessages } = await import('./adminDemo')
    return parseMessages(await demoMessages())
  }
  if (!supabase) throw new Error(MESSAGES_LOAD_FAILED)
  let res
  try {
    res = await supabase.rpc('admin_contact_list')
  } catch {
    throw new Error(MESSAGES_LOAD_FAILED) // network failure: never pass the raw message to the UI
  }
  if (res.error) throw new Error(res.error.code === '42501' ? MESSAGES_NOT_ALLOWED : MESSAGES_LOAD_FAILED)
  try {
    return parseMessages(res.data)
  } catch {
    throw new Error(MESSAGES_LOAD_FAILED)
  }
}

/** One void admin RPC that takes p_id. True on success; never throws. */
async function callById(fn: 'admin_contact_mark_read' | 'admin_contact_delete', id: number): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase.rpc(fn, { p_id: id })
    return !error
  } catch {
    return false
  }
}

/** rpc admin_contact_mark_read. The server keeps the first read time. */
export async function markMessageRead(id: number): Promise<boolean> {
  if (import.meta.env.DEV && DEMO_ADMIN) {
    const { demoMarkRead } = await import('./adminDemo')
    return demoMarkRead(id)
  }
  return callById('admin_contact_mark_read', id)
}

/** rpc admin_contact_delete. */
export async function deleteMessage(id: number): Promise<boolean> {
  if (import.meta.env.DEV && DEMO_ADMIN) {
    const { demoDeleteMessage } = await import('./adminDemo')
    return demoDeleteMessage(id)
  }
  return callById('admin_contact_delete', id)
}

export type MessagesData =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; messages: ContactMessage[] }

/**
 * Loads the list once `enabled` is true. `markRead` and `remove` call the server and, on success,
 * update the list in place without a reload. `retry` goes back to the loading state first.
 */
export function useMessages(enabled: boolean): {
  data: MessagesData
  retry: () => void
  markRead: (id: number) => Promise<boolean>
  remove: (id: number) => Promise<boolean>
} {
  const [data, setData] = useState<MessagesData>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // State is set in the promise callbacks only, never synchronously in the effect body.
  useEffect(() => {
    if (!enabled) return
    let current = true
    loadMessages().then(
      (messages) => {
        if (current && live.current) setData({ status: 'ready', messages })
      },
      (err: unknown) => {
        if (current && live.current) setData({ status: 'error', message: err instanceof Error ? err.message : MESSAGES_LOAD_FAILED })
      },
    )
    return () => {
      current = false
    }
  }, [enabled, attempt])

  const retry = useCallback(() => {
    setData({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const markRead = useCallback(async (id: number) => {
    const ok = await markMessageRead(id)
    if (ok && live.current) {
      const at = new Date().toISOString()
      setData((d) =>
        d.status === 'ready' ? { ...d, messages: d.messages.map((m) => (m.id === id ? { ...m, readAt: m.readAt ?? at } : m)) } : d,
      )
    }
    return ok
  }, [])

  const remove = useCallback(async (id: number) => {
    const ok = await deleteMessage(id)
    if (ok && live.current) {
      setData((d) => (d.status === 'ready' ? { ...d, messages: d.messages.filter((m) => m.id !== id) } : d))
    }
    return ok
  }, [])

  return { data, retry, markRead, remove }
}
