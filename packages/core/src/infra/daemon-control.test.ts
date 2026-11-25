import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { controlRecord, requestControl, startControl } from './daemon-control'

it('authenticates the local control channel, separates ping from stop and cleans up', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'timmy control '))
  let stops = 0
  const close = await startControl(dir, () => {
    stops++
    return Promise.resolve()
  })
  try {
    const record = controlRecord(dir)
    expect(record?.pid).toBe(process.pid)
    if (!record) throw new Error('Missing control record')
    await expect(requestControl({ ...record, token: 'wrong' }, 'stop')).rejects.toThrow('rejected')
    await requestControl(record, 'ping')
    expect(stops).toBe(0)
    await requestControl(record, 'stop')
    expect(stops).toBe(1)
  } finally {
    await close()
    expect(controlRecord(dir)).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  }
})
