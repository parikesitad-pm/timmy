import { createHash } from 'node:crypto'
import console from 'node:console'
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const output = resolve('release')
mkdirSync(output, { recursive: true })
const targetIndex = process.argv.indexOf('--target')
const assetIndex = process.argv.indexOf('--asset')
const target = targetIndex < 0 ? 'bun-windows-x64' : process.argv[targetIndex + 1]
const asset = assetIndex < 0 ? 'timmy-windows-x64.exe' : process.argv[assetIndex + 1]
if (!['bun-windows-x64', 'bun-darwin-arm64'].includes(target) || !/^[a-z0-9.-]+$/.test(asset))
  throw new Error('Unsupported release target or asset name')
const file = resolve(output, asset)
const voiceSource = resolve('packages/modules/voice')
const voiceFiles = [
  'pyproject.toml',
  'uv.lock',
  'README.md',
  ...readdirSync(resolve(voiceSource, 'src/timmy_voice_windows'))
    .filter((name) => name.endsWith('.py'))
    .map((name) => `src/timmy_voice_windows/${name}`),
]
const result = await globalThis.Bun.build({
  entrypoints: ['packages/core/src/index.ts'],
  define: {
    TIMMY_COMPILED: 'true',
    TIMMY_WINDOWS_VOICE_FILES: JSON.stringify(
      Object.fromEntries(
        voiceFiles.map((name) => [name, readFileSync(resolve(voiceSource, name), 'utf8')]),
      ),
    ),
    'process.env.DEV': 'false',
    'process.env.NODE_ENV': '"production"',
  },
  compile: { target, outfile: file },
  minify: true,
  plugins: [
    {
      name: 'omit-ink-development-tools',
      setup(build) {
        build.onLoad({ filter: /[/\\]ink[/\\]build[/\\]devtools\.js$/ }, () => ({
          contents: 'export {}',
          loader: 'js',
        }))
      },
    },
  ],
})
if (!result.success) throw new AggregateError(result.logs, 'Standalone executable build failed')
const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
writeFileSync(resolve(output, 'SHA256SUMS'), `${hash}  ${asset}\n`)
writeFileSync(resolve(output, `${asset}.sha256`), `${hash}  ${asset}\n`)
if (target === 'bun-windows-x64')
  copyFileSync('scripts/install-windows.ps1', resolve(output, 'install.ps1'))
console.log(
  `Standalone executable: ${file} (${(statSync(file).size / 1024 / 1024).toFixed(1)} MiB)`,
)
console.log('SHA256SUMS generated')
