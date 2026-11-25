import { appendFileSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { editorCommand } from './editor-command'
import { followLog } from './log-follower'
import { recommendedPlugins } from './plugin-cli'

it('parses executable paths and arguments without a shell and rejects broken quoting', () => {
  expect(editorCommand(undefined, 'win32')).toMatchObject({ executable: 'notepad.exe', args: [] })
  expect(editorCommand('code --wait', 'linux')).toMatchObject({
    executable: 'code',
    args: ['--wait'],
  })
  expect(
    editorCommand(String.raw`"C:\Program Files\Editor\editor.exe" --wait`, 'win32'),
  ).toMatchObject({ executable: String.raw`C:\Program Files\Editor\editor.exe`, args: ['--wait'] })
  expect(() => editorCommand('"unterminated')).toThrow('quoting')
})

it('keeps the macOS machine plugin out of Windows recommendations', () => {
  expect(recommendedPlugins('win32').map((plugin) => plugin.name)).toEqual(['web', 'shell'])
  expect(recommendedPlugins('darwin').some((plugin) => plugin.name === 'machine')).toBe(true)
})

it('follows creation, append, truncation and rotation on a path with spaces, then cancels', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'timmy log '))
  const file = join(dir, 'test log.txt')
  const controller = new AbortController()
  let output = ''
  const following = followLog(
    file,
    (text) => {
      output += text
    },
    controller.signal,
    10,
  )
  try {
    writeFileSync(file, 'one')
    await vi.waitFor(() => expect(output).toBe('one'))
    appendFileSync(file, 'two')
    await vi.waitFor(() => expect(output).toBe('onetwo'))
    writeFileSync(file, 't')
    await vi.waitFor(() => expect(output).toBe('onetwot'))
    renameSync(file, join(dir, 'old log.txt'))
    writeFileSync(file, 'R')
    await vi.waitFor(() => expect(output).toBe('onetwotR'))
  } finally {
    controller.abort()
    await following
    rmSync(dir, { recursive: true, force: true })
  }
})
