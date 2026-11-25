import { describe, it, expect } from 'vitest'
import { composeContextBlock, rankAndCap, Recall } from './recall'
import { Effect, Layer } from 'effect'
import { Config } from '../config/config'
import { Db } from '../persistence/db'
import { EntityStore } from './entity-store'
import { Embedder, makeEmbedder } from './embedder'
import type { Entity, Relation } from './types'

const e = (id: string, kind: string, name: string, p = {}): Entity => ({
  id,
  kind,
  name,
  properties: p,
  confidence: 0.8,
  source: 'conversation',
  lastUpdated: '',
})

it('recalls and searches stored entities by keyword when embeddings are unavailable', async () => {
  const storeLayer = EntityStore.Live.pipe(Layer.provide(Db.Live(':memory:')))
  const dependencies = Layer.mergeAll(
    storeLayer,
    Config.Live('/nonexistent/timmy-recall-fixture.yaml'),
    Layer.succeed(
      Embedder,
      makeEmbedder(() => Promise.resolve(null)),
    ),
  )
  const layer = Recall.Live.pipe(Layer.provideMerge(dependencies))
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* EntityStore
      yield* store.resolveAndUpsert({ kind: 'preference', name: 'Windows native' }, null)
      const recall = yield* Recall
      expect((yield* recall.forMessage('I need Windows native support')).entityNames).toContain(
        'Windows native',
      )
      expect((yield* recall.search('Windows', 5)).map((entity) => entity.name)).toEqual([
        'Windows native',
      ])
    }).pipe(Effect.provide(layer)),
  )
})

describe('composeContextBlock', () => {
  it('renders nodes + relations as a "What you know" block', () => {
    const ents = [e('1', 'person', 'Omat', { role: 'builder' }), e('2', 'company', 'Jitera')]
    const rels: Relation[] = [
      { id: 'r', from: '1', relation: 'works_at', to: '2', weight: 1, createdAt: '' },
    ]
    const block = composeContextBlock(ents, rels)
    expect(block).toContain('What you know about the user')
    expect(block).toContain('person: Omat')
    expect(block).toContain('role')
    expect(block).toContain('Omat --works_at--> Jitera') // endpoint ids resolved to names
  })
  it('returns empty string for no entities', () => {
    expect(composeContextBlock([], [])).toBe('')
  })
})

describe('rankAndCap', () => {
  it('always-on kept first, then seeds by score desc, then neighbors; deduped by id; capped to budget', () => {
    const always = [e('p', 'preference', 'lang')]
    const seeds = [
      { entity: e('s1', 'x', 'S1'), score: 0.9 },
      { entity: e('s2', 'x', 'S2'), score: 0.5 },
    ]
    const neighbors = [e('n1', 'x', 'N1'), e('s1', 'x', 'S1') /* dup of seed */]
    const out = rankAndCap(always, seeds, neighbors, 3)
    expect(out.map((x) => x.id)).toEqual(['p', 's1', 's2']) // budget=3: always(p) + top seeds; n1 dropped by cap; s1 dup not repeated
  })
  it('always-on are never dropped even if budget is small', () => {
    const always = [e('p1', 'preference', 'a'), e('p2', 'preference', 'b')]
    const out = rankAndCap(always, [{ entity: e('s', 'x', 'S'), score: 1 }], [], 1)
    expect(out.map((x) => x.id).sort()).toEqual(['p1', 'p2']) // always-on kept (≥ budget); seed dropped
  })
})
