import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Context, Effect, Stream } from 'effect'
import type { ThreadEvent } from '@openai/codex-sdk'
import type { LlmClient } from './llm-client'
import type { StreamChunk } from './stream-chunk'

export const DEFAULT_CODEX_MODEL = 'default'
const execFileAsync = promisify(execFile)

export const codexAvailable = Effect.tryPromise(async () => {
  await execFileAsync(
    process.env.CODEX_PATH ?? (process.platform === 'win32' ? 'codex.exe' : 'codex'),
    ['login', 'status'],
    { timeout: 10_000, windowsHide: true },
  )
  return true
}).pipe(Effect.orElseSucceed(() => false))

export const codexEventToChunk = (event: ThreadEvent): StreamChunk | null => {
  if (event.type === 'turn.completed')
    return {
      type: 'usage',
      promptTokens: event.usage.input_tokens,
      completionTokens: event.usage.output_tokens,
    }
  if (event.type === 'error' || event.type === 'turn.failed')
    return { type: 'error', message: 'Codex run failed' }
  if (event.type !== 'item.completed') return null
  const { item } = event
  if (item.type === 'agent_message') return { type: 'content', content: item.text }
  if (item.type === 'reasoning') return { type: 'thinking', content: item.text }
  if (item.type === 'error') return { type: 'error', message: 'Codex run failed' }
  if (['command_execution', 'file_change', 'mcp_tool_call', 'web_search'].includes(item.type))
    return { type: 'tool_call', toolCall: { id: item.id, name: item.type, arguments: '{}' } }
  return null
}

export const makeCodexProvider = (
  model: string,
  opts: { bypassPermissions?: boolean; reportActions?: boolean } = {},
): Context.Tag.Service<LlmClient> => ({
  chat: (messages) =>
    Stream.async<StreamChunk, never>((emit) => {
      const abortController = new AbortController()
      const run = async (): Promise<void> => {
        try {
          const { Codex } = await import('@openai/codex-sdk')
          const codex = new Codex({
            codexPathOverride:
              process.env.CODEX_PATH ?? (process.platform === 'win32' ? 'codex.exe' : 'codex'),
          })
          const thread = codex.startThread({
            model: model === DEFAULT_CODEX_MODEL ? undefined : model,
            workingDirectory: process.cwd(),
            skipGitRepoCheck: true,
            sandboxMode: opts.bypassPermissions ? 'danger-full-access' : 'workspace-write',
            approvalPolicy: 'never',
          })
          const prompt = messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n')
          const { events } = await thread.runStreamed(prompt, { signal: abortController.signal })
          for await (const event of events) {
            const chunk = codexEventToChunk(event)
            if (chunk?.type === 'tool_call' && !opts.reportActions)
              emit.single({ type: 'thinking', content: `Codex executed ${chunk.toolCall.name}` })
            else if (chunk) emit.single(chunk)
          }
        } catch {
          if (!abortController.signal.aborted)
            emit.single({ type: 'error', message: 'Codex run failed' })
        }
        emit.single({ type: 'finish', reason: 'stop' })
        emit.end()
      }
      void run()
      return Effect.sync(() => abortController.abort())
    }),
  isAvailable: () => codexAvailable,
  detectCapabilities: () =>
    Effect.succeed({ vision: false, audio: false, tools: true, realtime: false }),
})
