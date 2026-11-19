import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
// Plain override for the failure case: a throwing vi.fn is reported as a test failure by the runner.
const state: { boom: boolean } = { boom: false }
vi.mock('./auth', () => ({
  supabase: {
    rpc: (...a: unknown[]) => {
      if (state.boom) throw new Error('fetch failed at https://x.invalid')
      return rpc(...a)
    },
  },
}))

import { deleteMessage, loadMessages, markMessageRead } from './messagesApi'
import { MESSAGES_LOAD_FAILED, MESSAGES_NOT_ALLOWED } from './messagesLogic'

const one = {
  id: 7,
  created_at: '2026-11-16T09:15:00.000Z',
  name: null,
  email: 'brickfan@example.com',
  message: 'Could you add the promo figure?',
  read_at: null,
}

describe('loadMessages', () => {
  beforeEach(() => {
    rpc.mockReset()
    state.boom = false
  })

  it('calls admin_contact_list and parses the rows', async () => {
    rpc.mockResolvedValue({ data: [one], error: null })
    const out = await loadMessages()
    expect(rpc).toHaveBeenCalledWith('admin_contact_list')
    expect(out).toEqual([
      { id: 7, createdAt: one.created_at, name: null, email: one.email, message: one.message, readAt: null },
    ])
  })

  it('maps 42501 to Not allowed', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not an admin' } })
    await expect(loadMessages()).rejects.toThrow(MESSAGES_NOT_ALLOWED)
  })

  it('maps any other error to the generic text with no raw message', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'relation contact_messages broke' } })
    const err = await loadMessages().catch((e: Error) => e)
    expect((err as Error).message).toBe(MESSAGES_LOAD_FAILED)
    expect((err as Error).message).not.toMatch(/contact_messages/)
  })

  it('maps a thrown network error to the generic text', async () => {
    state.boom = true
    await expect(loadMessages()).rejects.toThrow(MESSAGES_LOAD_FAILED)
  })

  it('maps a malformed answer to the generic text', async () => {
    rpc.mockResolvedValue({ data: { not: 'a list' }, error: null })
    await expect(loadMessages()).rejects.toThrow(MESSAGES_LOAD_FAILED)
  })
})

describe('markMessageRead and deleteMessage', () => {
  beforeEach(() => {
    rpc.mockReset()
    state.boom = false
  })

  it('mark read sends p_id to admin_contact_mark_read', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(markMessageRead(7)).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('admin_contact_mark_read', { p_id: 7 })
  })

  it('delete sends p_id to admin_contact_delete', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(deleteMessage(7)).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('admin_contact_delete', { p_id: 7 })
  })

  it('an RPC error or a network failure answers false and never throws', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not an admin' } })
    await expect(markMessageRead(7)).resolves.toBe(false)
    await expect(deleteMessage(7)).resolves.toBe(false)
    state.boom = true
    await expect(markMessageRead(7)).resolves.toBe(false)
    await expect(deleteMessage(7)).resolves.toBe(false)
  })
})
