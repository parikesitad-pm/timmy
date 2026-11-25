import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { once } from 'node:events'
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createConnection, createServer } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

interface ControlRecord {
  pid: number
  address: string
  token: string
}
const recordPath = (dir: string) => join(dir, 'control.json')

export function controlRecord(dir: string): ControlRecord | null {
  if (!existsSync(recordPath(dir))) return null
  try {
    const value = JSON.parse(readFileSync(recordPath(dir), 'utf8')) as ControlRecord
    return Number.isSafeInteger(value.pid) &&
      typeof value.address === 'string' &&
      typeof value.token === 'string'
      ? value
      : null
  } catch {
    return null
  }
}

export async function startControl(
  dir: string,
  shutdown: () => Promise<void>,
): Promise<() => Promise<void>> {
  const id = createHash('sha256').update(dir).digest('hex').slice(0, 24)
  const address =
    process.platform === 'win32' ? `\\\\.\\pipe\\timmy-${id}` : join(tmpdir(), `timmy-${id}.sock`)
  if (process.platform !== 'win32') rmSync(address, { force: true })
  const token = randomBytes(32).toString('hex')
  const server = createServer((socket) => {
    let input = ''
    socket.setTimeout(3000, () => socket.destroy())
    socket.on('error', () => {})
    socket.on('data', (chunk) => {
      input += chunk.toString()
      if (input.length > 4096) return socket.destroy()
      if (!input.includes('\n')) return
      try {
        const message = JSON.parse(input.slice(0, input.indexOf('\n'))) as {
          token?: string
          command?: string
        }
        const received = Buffer.from(message.token ?? '')
        const expected = Buffer.from(token)
        const allowed = received.length === expected.length && timingSafeEqual(received, expected)
        if (!allowed || !['ping', 'stop'].includes(message.command ?? ''))
          return socket.end('{"ok":false}\n')
        socket.end(JSON.stringify({ ok: true, pid: process.pid }) + '\n')
        if (message.command === 'stop') void shutdown()
      } catch {
        socket.end('{"ok":false}\n')
      }
    })
  })
  server.listen(address)
  await once(server, 'listening')
  if (process.platform !== 'win32') chmodSync(address, 0o600)
  writeFileSync(recordPath(dir), JSON.stringify({ pid: process.pid, address, token }), {
    mode: 0o600,
  })
  return async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    if (controlRecord(dir)?.pid === process.pid) rmSync(recordPath(dir), { force: true })
    if (process.platform !== 'win32') rmSync(address, { force: true })
  }
}

export function requestControl(record: ControlRecord, command: 'ping' | 'stop'): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(record.address)
    let input = ''
    socket.setTimeout(3000, () => socket.destroy(new Error('Daemon control timed out')))
    socket.once('error', reject)
    socket.once('connect', () =>
      socket.write(JSON.stringify({ token: record.token, command }) + '\n'),
    )
    socket.on('data', (chunk) => {
      input += chunk.toString()
      if (input.length > 4096) return socket.destroy(new Error('Invalid control response'))
      if (!input.includes('\n')) return
      socket.end()
      try {
        const response = JSON.parse(input.slice(0, input.indexOf('\n')))
        if (!response.ok || response.pid !== record.pid)
          return reject(new Error('Daemon control rejected the request'))
        resolve()
      } catch {
        reject(new Error('Invalid control response'))
      }
    })
    socket.once('end', () => {
      if (!input.includes('\n')) reject(new Error('Daemon control closed without a response'))
    })
  })
}
