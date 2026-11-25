// Probe lingkungan saja: tidak menjalankan Timmy, membaca config/credential,
// membuka database, mengunduh dependency, atau mengubah sistem.
import { spawnSync } from 'node:child_process'
import console from 'node:console'
import process from 'node:process'
import { createServer } from 'node:http'
import { win32 } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

let failed = false
function report(name, passed) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
  if (!passed) failed = true
}

console.log(`Runtime: ${process.version}; platform: ${process.platform}; arch: ${process.arch}`)
report('Windows native', process.platform === 'win32')
report('Node >=24', Number(process.versions.node.split('.')[0]) >= 24)

try {
  const sqlite = await import('node:sqlite')
  report('node:sqlite tersedia (tanpa membuka database)', typeof sqlite.DatabaseSync === 'function')
} catch {
  report('node:sqlite tersedia (tanpa membuka database)', false)
}

const child = spawnSync(process.execPath, ['-e', 'process.exit(0)'], {
  stdio: 'ignore',
  windowsHide: true,
  timeout: 5000,
})
report('Spawn node.exe tanpa shell', child.status === 0 && !child.error)

if (process.platform === 'win32') {
  const sample = win32.join('C:\\', 'Timmy Pilot', 'plugin', 'index.js')
  report(
    'Windows path dengan spasi: file URL roundtrip',
    fileURLToPath(pathToFileURL(sample)) === sample,
  )
}

const server = createServer((_req, res) => res.end('timmy-probe'))
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  const res = await globalThis.fetch(`http://127.0.0.1:${port}`, {
    signal: globalThis.AbortSignal.timeout(5000),
  })
  report('HTTP loopback lokal', res.ok && (await res.text()) === 'timmy-probe')
} catch {
  report('HTTP loopback lokal', false)
} finally {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}

console.log('Ini bukan hasil build/test atau bukti Timmy sudah berjalan.')
process.exitCode = failed ? 1 : 0
