import { open } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { StringDecoder } from 'node:string_decoder'

export async function followLog(
  path: string,
  write: (text: string) => void | Promise<void>,
  signal: AbortSignal,
  interval = 200,
): Promise<void> {
  let offset = 0
  let identity = ''
  let decoder = new StringDecoder('utf8')
  const buffer = Buffer.alloc(64 * 1024)
  while (!signal.aborted) {
    try {
      const file = await open(path, 'r')
      try {
        const stat = await file.stat()
        const next = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`
        if (identity !== next || stat.size < offset) {
          offset = 0
          decoder = new StringDecoder('utf8')
        }
        identity = next
        while (offset < stat.size && !signal.aborted) {
          const { bytesRead } = await file.read(
            buffer,
            0,
            Math.min(buffer.length, stat.size - offset),
            offset,
          )
          if (!bytesRead) break
          offset += bytesRead
          await write(decoder.write(buffer.subarray(0, bytesRead)))
        }
      } finally {
        await file.close()
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    try {
      await setTimeout(interval, undefined, { signal })
    } catch (error) {
      if (!signal.aborted) throw error
    }
  }
  const tail = decoder.end()
  if (tail) await write(tail)
}
