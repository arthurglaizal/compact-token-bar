import { describe, expect, test } from 'claude-code/testing'

import { barSvg, cardSvg, cells, layout, swatchSvg, legend, ramp, resets, share, toReading, tokens, zigzag } from '../hooks/register'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 84 } }

// /context's breakdown as the engine hands it over, for a 1M window.
const BREAKDOWN = {
  categories: [
    { name: 'System prompt', tokens: 3_400, color: 'promptBorder', kind: 'used', isDeferred: false },
    { name: 'System tools', tokens: 12_000, color: 'inactive', kind: 'used', isDeferred: false },
    { name: 'MCP tools', tokens: 2_600, color: 'cyan_FOR_SUBAGENTS_ONLY', kind: 'used', isDeferred: false },
    { name: 'MCP tools (deferred)', tokens: 40_000, color: 'inactive', kind: 'deferred', isDeferred: true },
    { name: 'Skills', tokens: 0, color: 'warning', kind: 'used', isDeferred: false },
    { name: 'Messages', tokens: 186_000, color: 'purple_FOR_SUBAGENTS_ONLY', kind: 'used', isDeferred: false },
    { name: 'Autocompact buffer', tokens: 50_000, color: 'inactive', kind: 'buffer', isDeferred: false },
    { name: 'Free space', tokens: 746_000, color: 'promptBorder', kind: 'free', isDeferred: false },
  ],
  totalTokens: 204_000,
  maxTokens: 1_000_000,
  rawMaxTokens: 1_000_000,
  percentage: 20,
  autoCompactThreshold: 950_000,
  isAutoCompactEnabled: true,
  gridRows: [],
  memoryFiles: [],
  mcpTools: [],
  agents: [],
  model: 'opus',
  apiUsage: null,
  autocompactSource: 'model-default',
}

// Stands for the engine beneath the mod.
function engine(on: any, store: Record<string, unknown> = {}) {
  const asked: unknown[] = []
  on('session.start', (_$: any, e: any) => ({ sessionId: 's', cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }))
  on('turn.complete', () => ({ text: '' }))
  on('clock.now', () => ({ value: Date.now() }))
  on('store.get', (_$: any, e: any) => ({ value: store[e.key] }))
  on('store.set', (_$: any, e: any) => ((store[e.key] = e.value), { value: undefined }))
  on('session.usage', (_$: any, e: any) => {
    asked.push(e)
    return { value: { startedAt: 0, context: { tokens: 204_000, window: 1_000_000, percent: 20, breakdown: BREAKDOWN }, rateLimits: [{ kind: 'five_hour', percentUsed: 42.4, resetsAt: new Date(Date.now() + 130 * 60_000).toISOString() }, { kind: 'seven_day', percentUsed: 91 }, { kind: 'spend_limit', percentUsed: 5 }], cost: { usd: 0 } } }
  })
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Text({ children: 'band below' }))
  return { asked, store }
}

const settle = () => new Promise(done => (globalThis as any).setTimeout(done, 20)) // the first refresh runs in the background

describe('compact-token-bar', () => {
  test('helpers', () => {
    expect(tokens(3_400)).toBe('3.4k')
    expect(tokens(186_000)).toBe('186k')
    expect(tokens(1_000_000)).toBe('1M')
    expect(tokens(950)).toBe('950')
    expect(share(3_400, 1_000_000)).toBe('0.3%')
    expect(share(186_000, 1_000_000)).toBe('19%')
    expect(share(494, 1_000_000)).toBe('<0.1%')

    const r = toReading(BREAKDOWN)
    // Deferred and empty rows are left out; used first, then free, then the buffer.
    expect(r.slices.map(s => s.name)).toEqual(['system prompt', 'system tools', 'mcp tools', 'messages', 'free space', 'autocompact buffer'])
    expect(r.compactsAt).toBe(950_000)
    // Every used row has its own color, and none matches free space or the buffer.
    const colors = r.slices.filter(s => s.kind === 'used').map(s => s.color)
    expect(new Set(colors).size).toBe(colors.length)
    expect(cells(r, 80).find(c => c.kind === 'buffer')?.text).toMatch(/^▃+$/)
    expect(cells(r, 80).find(c => c.kind === 'free')?.text).toMatch(/^─+$/)
    // Messages are the dotted block; the other used rows are solid.
    expect(r.slices.find(s => s.name === 'messages')?.glyph).toBe('⠿') // quiet dots, no accent color

    for (const width of [20, 47, 80, 200]) {
      const bar = cells(r, width)
      expect(bar.reduce((n, c) => n + c.text.length, 0)).toBe(width) // always exactly the width
      expect(bar.filter(c => c.kind === 'used').every(c => c.text.length >= 1)).toBe(true) // a small used slice still shows
    }
    for (const line of legend(r, 40)) {
      const size = line.reduce((n, s, i) => n + (i ? 3 : 0) + 2 + s.name.length + 1 + tokens(s.tokens).length + (s.kind === 'used' ? 1 + share(s.tokens, r.window).length : 0), 0)
      expect(size <= 40 || line.length === 1).toBe(true)
    }
    expect(toReading({ ...BREAKDOWN, isAutoCompactEnabled: false }).compactsAt).toBeUndefined()
    // The slate ramp runs from its dark end to its light end.
    expect(ramp(0, 4)).toBe('#4c5568')
    expect(ramp(3, 4)).toBe('#868fa0')
    expect([0, 1, 2, 3, 4].map(k => zigzag(k, 5))).toEqual([0, 3, 1, 4, 2]) // every step of the ramp, once
    // The vector bar: one tooltip per segment, a pattern per category, no script.
    const svg = barSvg(r, 14)
    expect(svg).toContain('<title>messages · 186k · 19%</title>')
    expect(svg.match(/<pattern /g)!.length).toBe(5) // four used rows and the buffer; free space is a line
    expect(svg).not.toMatch(/<script|on\w+=|transparent/)
    expect(svg).toContain('viewBox="0 0 1800 14"')
    // The desktop card: small grey text over the bar, warm figures colored.
    const card = cardSvg(r, 700)
    // One line: the bar sits between the title and the figures, the chevron at the end.
    const at = layout(r, 700)
    expect(at.barX).toBeGreaterThan(40)
    expect(at.barX + at.barWidth).toBeLessThan(at.figuresEnd - 100) // the figures keep their room
    expect(card).not.toContain('<path') // the chevron is a button beside the picture, not drawn in it
    expect(card).toContain('>Context</text>')
    expect(card).toContain('204k of 950k') // against the compaction point, the real limit
    expect(card).not.toContain('compacts at')
    expect(card).toContain('font-size="11"')
    expect(card).toContain('font-size="13">Context</text>') // the title, a little larger
    expect(card).not.toContain('>messages <') // folded: no legend
    const opened = cardSvg(r, 700, true)
    expect(opened).toContain('>messages </tspan>')
    expect(opened).toContain('>186k</tspan>')
    expect((opened.match(/<circle/g) ?? []).length).toBe(4) // the quincunx of messages (two dots a tile), in the bar and in its swatch
    // A share under 0.1% is escaped: a bare "<" would make the picture fail to load.
    const tiny = cardSvg(toReading({ ...BREAKDOWN, categories: [...BREAKDOWN.categories, { name: 'Memory files', tokens: 50, color: 'x', kind: 'used', isDeferred: false }] }), 700, true)
    expect(tiny).toContain('&lt;0.1%')
    expect(tiny).not.toMatch(/> ?<0\.1%/)
    // A legend swatch carries the same pattern as its segment in the bar.
    const msgs = r.slices.find(s => s.name === 'messages')!
    expect(swatchSvg(r, msgs)).toContain('<circle')
    expect(resets(undefined, 0)).toBe('')
    expect(resets(new Date(130 * 60_000).toISOString(), 0)).toBe(' · resets in 2 h 10')
    expect(resets(new Date(3 * 86_400_000 + 5 * 3_600_000).toISOString(), 0)).toBe(' · resets in 3 d 5 h')
    // Only the session and weekly windows are kept, session first.
    expect(toReading(BREAKDOWN, [{ kind: 'seven_day', percentUsed: 9.6 }, { kind: 'spend_limit', percentUsed: 1 }, { kind: 'five_hour', percentUsed: 3 }]).limits.map(l => [l.kind, l.percent])).toEqual([['five_hour', 3], ['seven_day', 10]])
  })

  test('draws the bar folded, with a label on each segment', async ($, on) => {
    const { asked } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await settle()
    expect(asked).toEqual([{ breakdown: 'summary' }]) // estimated locally, never the token-count API

    const band = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'terminal', ...BAND } as any)
    expect(await band.find({ type: 'Text', text: /^204k of 950k$/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: '21%' })).toBeDefined() // 204k of 950k; grey: no badge while the window is cool
    expect(await band.find({ type: 'Text', text: /messages · 186k · 19%/ })).toBeDefined() // the hover label of a segment
    expect(await band.find({ type: 'Text', text: '5h 42%' })).toBeDefined() // session limit
    expect(await band.find({ type: 'Text', text: 'week 91%' })).toBeDefined() // weekly limit
    expect(await band.find({ type: 'Text', text: /Session limit \(5 h\) · 42% used · resets in 2 h/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /^ ?.* · 5% used/ })).toBeUndefined() // a gateway's spend limit is not shown
    expect(await band.find({ type: 'Text', text: /^messages $/ })).toBeUndefined() // the legend is folded
    expect(await band.find({ type: 'Text', text: 'band below' })).toBeDefined() // the band beneath stays
    await band.unmount()
  })

  test('the desktop draws the bar as an SVG', async ($, on) => {
    engine(on)
    await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' } as any)
    await settle()
    const band = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'desktop', ...BAND } as any)
    const svg = await band.find({ type: 'Svg' })
    expect(svg).toBeDefined()
    expect(await band.find({ type: 'Text', text: /messages · 186k · 19%/ })).toBeDefined() // the label of a segment, over the picture
    expect(await band.find({ type: 'Text', text: /Session limit \(5 h\) · 42% used/ })).toBeDefined() // the limits' label
    // Opened, the legend is drawn in the same picture, each swatch with the bar's own pattern.
    await band.press({ key: 'toggle-legend' })
    expect(await band.find({ type: 'Svg' })).toBeDefined()
    await band.unmount()
  })

  test('the arrow opens and folds the legend', async ($, on) => {
    engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await settle()
    const band = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'terminal', ...BAND } as any)
    await band.press({ key: 'toggle-legend' })
    expect(await band.find({ type: 'Text', text: /^messages $/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /^186k$/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /mcp tools \(deferred\)/ })).toBeUndefined()
    await band.press({ key: 'toggle-legend' })
    expect(await band.find({ type: 'Text', text: /^messages $/ })).toBeUndefined()
    await band.unmount()
  })

  test('the cross closes the bar', async ($, on) => {
    const { store } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await settle()
    const band = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'terminal', ...BAND } as any)
    await band.press({ key: 'close' })
    expect(store.isHidden).toBe(true)
    await band.unmount()
    const again = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'terminal', ...BAND } as any)
    expect(await again.find({ type: 'Text', text: /of 950k/ })).toBeUndefined()
    await again.unmount()
  })

  test('refreshes after a main turn, not after a subagent turn', async ($, on) => {
    const { asked } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await settle()
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1, agentId: 'a1' } as any)
    expect(asked.length).toBe(1)
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1 } as any)
    expect(asked.length).toBe(2)
  })

  test('refreshes after a compaction', async ($, on) => {
    const { asked } = engine(on)
    on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await settle()
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as any)
    await settle()
    expect(asked.length).toBe(2)
  })

  test('/compact-token-bar hides and shows it, and remembers the choice', async ($, on) => {
    const { store } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await settle()
    expect((await $.command.run({ command: 'compact-token-bar', args: '' } as any)).text).toMatch(/hidden/)
    expect(store.isHidden).toBe(true)
    let band = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'terminal', ...BAND } as any)
    expect(await band.find({ type: 'Text', text: /of 950k/ })).toBeUndefined()
    await band.unmount()

    expect((await $.command.run({ command: 'compact-token-bar', args: '' } as any)).text).toBe('Context bar on')
    expect(store.isHidden).toBe(false)
    band = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'terminal', ...BAND } as any)
    expect(await band.find({ type: 'Text', text: /of 950k/ })).toBeDefined()
    await band.unmount()
  })

  test('a session that hid it starts hidden', async ($, on) => {
    engine(on, { isHidden: true })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await settle()
    const band = await $.ui.mount({ plugin: 'compact-token-bar', surface: 'terminal', ...BAND } as any)
    expect(await band.find({ type: 'Text', text: /of 950k/ })).toBeUndefined()
    await band.unmount()
  })
})
