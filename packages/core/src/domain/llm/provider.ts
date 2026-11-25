import { Context, Effect, Option, Stream } from 'effect'
import { AuthError, ApiError, NetworkError, RateLimitError, type LlmError } from './errors'
import { capabilitiesFor } from './capabilities'
import { LlmClient, makeOllamaClient, type ChatMessage } from './llm-client'
import type { StreamChunk } from './stream-chunk'
import { emptyFoldState, foldDelta, parseOpenAiData } from './openai-parser'
import { makeCodexProvider } from './codex-provider'

export type ProviderKind = 'ollama' | 'openai-compat' | 'codex'
export interface ProviderTarget {
  providerKey: string
  kind: ProviderKind
  model: string
  baseUrl?: string
  apiKey?: string
  /** codex only: "auto mode" — use full filesystem access instead of workspace-write. */
  bypassPermissions?: boolean
  reportActions?: boolean
}

type Service = Context.Tag.Service<LlmClient>

/** Map our canonical ChatMessage[] to the OpenAI chat-completions wire shape. Strict
 *  OpenAI-compatible APIs (OpenAI/DeepSeek) require an assistant turn's `tool_calls`
 *  (with id + function) AND a matching `tool_call_id` on each tool-result message —
 *  a bare `{role:'tool',content}` (Ollama-lenient) is rejected with HTTP 400. */
export const toOpenAiMessages = (messages: ChatMessage[]): unknown[] =>
  messages.map((m) => {
    if (m.role === 'assistant' && m.tool_calls?.length) {
      return {
        role: 'assistant',
        content: m.content ?? '',
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      }
    }
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content }
    // Inline images → OpenAI multimodal content parts (text + image_url data URLs).
    if (m.images?.length) {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content },
          ...m.images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      }
    }
    return { role: m.role, content: m.content }
  })

const makeOpenAiCompat = (t: ProviderTarget): Service => ({
  chat: (messages, tools) =>
    Stream.unwrapScoped(
      Effect.gen(function* () {
        const controller = yield* Effect.acquireRelease(
          Effect.sync(() => new AbortController()),
          (controller) => Effect.sync(() => controller.abort()),
        )
        const res = yield* Effect.tryPromise({
          try: () =>
            fetch(`${t.baseUrl}/chat/completions`, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${t.apiKey ?? ''}`,
              },
              body: JSON.stringify({
                model: t.model,
                messages: toOpenAiMessages(messages),
                ...(tools ? { tools } : {}),
                stream: true,
                stream_options: { include_usage: true },
              }),
            }),
          catch: (e) => new NetworkError({ message: `${t.providerKey} request failed`, cause: e }),
        })
        if (!res.ok || !res.body) {
          // Surface the provider's error body — otherwise a 400 (e.g. malformed tool
          // messages) is an opaque "<provider> 400" with no clue what to fix.
          const body = yield* Effect.tryPromise(() => res.text()).pipe(
            Effect.orElseSucceed(() => ''),
          )
          const detail = body ? `: ${body.slice(0, 500)}` : ''
          if (res.status === 401 || res.status === 403)
            return Stream.fail(
              new AuthError({
                message: `${t.providerKey} auth failed (${res.status})${detail}`,
                provider: t.providerKey,
              }),
            ) as Stream.Stream<StreamChunk, LlmError>
          if (res.status === 429)
            return Stream.fail(
              new RateLimitError({ message: `${t.providerKey} rate limited${detail}` }),
            ) as Stream.Stream<StreamChunk, LlmError>
          return Stream.fail(
            new ApiError({
              message: `${t.providerKey} ${res.status}${detail}`,
              status: res.status,
            }),
          ) as Stream.Stream<StreamChunk, LlmError>
        }
        return Stream.fromReadableStream(
          () => res.body!,
          (e) => new NetworkError({ message: 'stream read failed', cause: e }),
        ).pipe(
          Stream.decodeText('utf-8'),
          Stream.splitLines,
          Stream.map((l) => l.trim()),
          Stream.filter((l) => l.startsWith('data:')),
          Stream.map((l) => l.slice(5).trim()),
          Stream.takeWhile((d) => d !== '[DONE]'),
          Stream.filterMap((d) => {
            const delta = parseOpenAiData(d)
            return delta ? Option.some(delta) : Option.none()
          }),
          Stream.mapAccum(emptyFoldState(), (st, delta) => foldDelta(st, delta)),
          Stream.flattenIterables,
        ) as Stream.Stream<StreamChunk, LlmError>
      }),
    ),
  isAvailable: () =>
    Effect.tryPromise(() =>
      fetch(`${t.baseUrl}/models`, { headers: { authorization: `Bearer ${t.apiKey ?? ''}` } }),
    ).pipe(
      Effect.map((r) => r.ok),
      Effect.catchAll(() => Effect.succeed(false)),
    ),
  detectCapabilities: () => Effect.succeed(capabilitiesFor(t.model)),
})

/** Build an LlmClient-shaped value for a target, selecting the impl by kind. */
export const makeProvider = (t: ProviderTarget): Service => {
  switch (t.kind) {
    case 'ollama':
      return makeOllamaClient({ baseUrl: t.baseUrl ?? 'http://localhost:11434', model: t.model })
    case 'openai-compat':
      return makeOpenAiCompat(t)
    case 'codex':
      return makeCodexProvider(t.model, {
        bypassPermissions: t.bypassPermissions,
        reportActions: t.reportActions,
      })
    default:
      throw new Error(
        'Unsupported provider kind; configure Codex with `timmy model askcodex default`.',
      )
  }
}
