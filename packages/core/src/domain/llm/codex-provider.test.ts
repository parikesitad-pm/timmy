import { Effect, Stream } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThreadEvent } from '@openai/codex-sdk'
import { codexEventToChunk, makeCodexProvider } from './codex-provider'

const { startThread, runStreamed } = vi.hoisted(() => ({
  startThread: vi.fn(),
  runStreamed: vi.fn(),
}))
vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    startThread = startThread
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  startThread.mockReturnValue({ runStreamed })
})

const events: ThreadEvent[] = [
  { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'Checking' } },
  {
    type: 'item.completed',
    item: {
      id: 'c',
      type: 'command_execution',
      command: 'echo hi',
      aggregated_output: 'hi',
      status: 'completed',
      exit_code: 0,
    },
  },
  { type: 'item.completed', item: { id: 'a', type: 'agent_message', text: 'Done' } },
  {
    type: 'turn.completed',
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cached_input_tokens: 0,
      cache_write_input_tokens: 0,
      reasoning_output_tokens: 0,
    },
  },
]

describe('Codex provider', () => {
  it('does not send already-executed SDK actions back through the Timmy tool loop', async () => {
    runStreamed.mockResolvedValue({
      events: (async function* () {
        yield* events
      })(),
    })
    const chunks = [
      ...(await Effect.runPromise(
        Stream.runCollect(makeCodexProvider('default').chat([{ role: 'user', content: 'x' }])),
      )),
    ]
    expect(chunks.some((chunk) => chunk.type === 'tool_call')).toBe(false)
    expect(chunks.some((chunk) => chunk.type === 'content' && chunk.content === 'Done')).toBe(true)
  })
  it('streams actions, answer and usage once; inherits the configured model and cancels on cleanup', async () => {
    runStreamed.mockResolvedValue({
      events: (async function* () {
        yield* events
      })(),
    })
    const chunks = await Effect.runPromise(
      Stream.runCollect(
        makeCodexProvider('default', { reportActions: true }).chat([
          { role: 'user', content: 'hello' },
        ]),
      ),
    )
    expect([...chunks]).toEqual([
      { type: 'thinking', content: 'Checking' },
      { type: 'tool_call', toolCall: { id: 'c', name: 'command_execution', arguments: '{}' } },
      { type: 'content', content: 'Done' },
      { type: 'usage', promptTokens: 10, completionTokens: 5 },
      { type: 'finish', reason: 'stop' },
    ])
    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        model: undefined,
        workingDirectory: process.cwd(),
        sandboxMode: 'workspace-write',
      }),
    )
    expect(runStreamed.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('does not repeat cumulative item updates or leak raw errors', () => {
    expect(
      codexEventToChunk({
        type: 'item.updated',
        item: { id: 'a', type: 'agent_message', text: 'partial' },
      }),
    ).toBeNull()
    expect(
      codexEventToChunk({ type: 'turn.failed', error: { message: 'private failure detail' } }),
    ).toEqual({ type: 'error', message: 'Codex run failed' })
  })

  it('reports an SDK rejection and finishes', async () => {
    runStreamed.mockRejectedValue(new Error('private failure detail'))
    const chunks = await Effect.runPromise(
      Stream.runCollect(makeCodexProvider('custom').chat([{ role: 'user', content: 'x' }])),
    )
    expect([...chunks]).toEqual([
      { type: 'error', message: 'Codex run failed' },
      { type: 'finish', reason: 'stop' },
    ])
    expect(startThread).toHaveBeenCalledWith(expect.objectContaining({ model: 'custom' }))
  })
})
