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

import { loadLists, LOAD_FAILED, NOT_ALLOWED } from './adminApi'

const ok = { data: [], error: null }

describe('loadLists error text', () => {
  beforeEach(() => {
    rpc.mockReset()
    state.boom = false
  })

  it('returns empty lists on success', async () => {
    rpc.mockResolvedValue(ok)
    await expect(loadLists()).resolves.toEqual({ people: [], wanted: [] })
  })

  it('maps 42501 to Not allowed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied for table admins' } })
    rpc.mockResolvedValueOnce(ok)
    await expect(loadLists()).rejects.toThrow(NOT_ALLOWED)
  })

  it('maps any other error to a generic text with no raw message', async () => {
    rpc.mockResolvedValueOnce(ok)
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'relation secret_table broke' } })
    const err = await loadLists().catch((e: Error) => e)
    expect((err as Error).message).toBe(LOAD_FAILED)
    expect((err as Error).message).not.toMatch(/secret_table/)
  })

  it('maps a thrown network error to the generic text', async () => {
    state.boom = true
    await expect(loadLists()).rejects.toThrow(LOAD_FAILED)
  })
})
