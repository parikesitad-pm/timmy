import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const lines = readdirSync('release')
  .filter((file) => file.endsWith('.sha256'))
  .sort()
  .map((file) => {
    const line = readFileSync(join('release', file), 'utf8').trim()
    const match = /^([a-f0-9]{64}) {2}(timmy-[a-z0-9.-]+)$/.exec(line)
    if (!match) throw new Error(`Invalid checksum record: ${file}`)
    const hash = createHash('sha256')
      .update(readFileSync(join('release', match[2])))
      .digest('hex')
    if (hash !== match[1]) throw new Error(`Artifact checksum mismatch: ${match[2]}`)
    return line
  })
if (!lines.length) throw new Error('No release checksum records found')
writeFileSync('release/SHA256SUMS', lines.join('\n') + '\n')
