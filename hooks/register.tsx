// Compact Claude Token: what is filling my context window?
//   Fork of context-bar (hamzafer/claude-code-mods, MIT). Above the prompt, the window as one
//   stacked bar. Colors are a neutral slate ramp and every category has its own texture (stripes,
//   grid...), so the bar reads without color; messages are quiet dots on a grey ground. Hovering a segment shows its label. The detailed legend is folded by default: the
//   chevron at the end of the bar opens it. Next to it, the session and weekly limits.
//   /compact-token-bar shows or hides the bar, and the choice is kept across sessions.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Reading, Slice } from '../types'

const MIN_WIDTH = 20 // narrower than this, the bar is not drawn
const SPLIT = '   '
// One slate ramp, dark to light, spread over the used categories; the texture keeps neighbours apart.
const RAMP = ['#566178', '#a9b3c6'] as const
// One texture per used category; messages, the row that grows, are quiet dots on a grey ground.
const TEXTURES = ['▓', '▚', '▒', '▞', '▌', '▀', '▄'] // block elements fill their cell: no gaps between neighbours
const MESSAGES = { color: '#9aa5b8', glyph: '⠪', background: '#3a4152' } as const
const FREE = '#808080' // a mid grey thin line reads as empty on dark and light themes alike
const BUFFER = '#808080'
const GLYPH = { free: '─', buffer: '░' } as const
// A clock for the window that counts in hours, a grid (a calendar) for the one that counts in days.
// Plain text glyphs: an emoji would bring its own colors and size.
const LIMITS = { five_hour: { icon: '◷', label: 'Limite de session (5 h)' }, seven_day: { icon: '▦', label: 'Limite hebdomadaire (7 jours)' } } as const
const ORANGE = '#e08a3c'
const CHEVRON = { closed: '⌄', open: '⌃' } as const // down to open, up to fold

// Held by the host, so the bar survives a hot reload of this file.
const reading = atom({ plugin: 'compact-token-bar', key: 'reading' } as const, null as Reading | null)
const isHidden = atom({ plugin: 'compact-token-bar', key: 'isHidden' } as const, false)
const isExpanded = atom({ plugin: 'compact-token-bar', key: 'isExpanded' } as const, false)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'compact-token-bar', description: 'Affiche ou masque la barre de contexte au-dessus du prompt' }).catch(() => {}) // a name Claude Code already has is refused: start anyway
    const hidden = (await $.store.get('isHidden').catch(() => undefined)) === true
    await update($, isHidden, () => hidden)
    void refresh($).catch(() => {})
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId) await refresh($).catch(() => {}) // a subagent's turn fills its own window, not this one
    return r
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId && 'messages' in r) void refresh($).catch(() => {}) // a /compact empties the window without a turn ending
    return r
  })

  on('command.run', { command: 'compact-token-bar' }, async $ => {
    const hidden = await update($, isHidden, h => !h)
    await $.store.set('isHidden', hidden).catch(() => {})
    if (!hidden) await refresh($).catch(() => {})
    return { text: hidden ? 'Barre de contexte masquée. /compact-token-bar la réaffiche' : 'Barre de contexte affichée' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e) // what other mods and Claude Code draw here stays
    const r = await read($, reading)
    if (e.props.hasSurvey || (await read($, isHidden)) || !r) return rest
    const { Box, Text, Button } = $.ui.resolve(e)
    const inner = e.props.bodyColumns - 4 // the border and padding take 4 cells
    if (inner < MIN_WIDTH) return rest
    const open = await read($, isExpanded)

    const head = `${tokens(r.total)} sur ${tokens(r.window)}${r.compactsAt ? ` · compactage à ${tokens(r.compactsAt)}` : ''}`
    const level = r.compactsAt ? r.total / r.compactsAt : r.total / r.window
    const heat = level >= 0.9 ? 'red' : level >= 0.7 ? ORANGE : undefined // grey until it gets warm
    const barWidth = inner - 6 // the fold button, a bordered `[ ⌄ ]`, takes the end of the line
    const now = await $.clock.now()
    // A segment grows in proportion to its cells and the glyphs are cut to fit: a font whose glyphs are not
    // one cell wide (the desktop) then never wraps the bar onto a second line.
    let at = 0 // the column a segment starts at, to anchor its label on the side with room
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" borderStyle="round" borderColor="inactive" paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>Contexte</Text>
            <Box flexDirection="row">
              <Text dimColor wrap="truncate-start">{head}</Text>
              <Box marginLeft={2}>
                {heat ? <Text bold color="black" backgroundColor={heat}>{` ${r.percent}% `}</Text> : <Text dimColor>{`${r.percent}%`}</Text>}
              </Box>
              {r.limits.length > 0 && (
                <Box marginLeft={2}>
                  <Text dimColor>{'│  limite'}</Text>
                </Box>
              )}
              {r.limits.map(l => {
                const hot = l.percent >= 90 ? 'red' : l.percent >= 70 ? ORANGE : undefined
                return (
                  <Box key={`limit-${l.kind}`} marginLeft={2}>
                    <Text dimColor={!hot} color={hot}>{`${LIMITS[l.kind].icon} ${l.percent}%`}</Text>
                    <Box position="absolute" top={1} right={0} display="none" hover={{ display: 'flex' }}>
                      <Text bold color="black" backgroundColor="white" wrap="truncate-end">
                        {` ${LIMITS[l.kind].label} · ${l.percent}% utilisé${resets(l.resetsAt, now)} `}
                      </Text>
                    </Box>
                  </Box>
                )
              })}
              <Box marginLeft={2}>
                <Button key="close" plain dimColor onPress={() => void hide($)}>
                  ✕
                </Button>
              </Box>
            </Box>
          </Box>
          <Box flexDirection="row">
            <Box flexDirection="row" flexGrow={1}>
              {cells(r, barWidth).map((c, i) => {
                const onRight = at + c.text.length / 2 > barWidth / 2
                at += c.text.length
                return (
                  <Box key={`seg-${i}`} width={0} flexGrow={c.text.length} height={1}>
                    {/* the glyphs overshoot and are clipped, so no ellipsis ends a short segment */}
                    <Box width={0} flexGrow={1} height={1} overflow="hidden">
                      <Text color={c.color} backgroundColor={c.slice.background} wrap="wrap">{c.text.repeat(3)}</Text>
                    </Box>
                    <Box position="absolute" top={-1} {...(onRight ? { right: 0 } : { left: 0 })} display="none" hover={{ display: 'flex' }}>
                      <Text bold color="black" backgroundColor={c.kind === 'used' ? c.color : 'white'} wrap="truncate-end">
                        {` ${c.slice.name} · ${tokens(c.slice.tokens)} · ${share(c.slice.tokens, r.window)} `}
                      </Text>
                    </Box>
                  </Box>
                )
              })}
            </Box>
            <Box marginLeft={1}>
              <Button key="toggle-legend" onPress={() => void update($, isExpanded, v => !v)}>
                {open ? CHEVRON.open : CHEVRON.closed}
              </Button>
            </Box>
          </Box>
          {open &&
            legend(r, inner).map(line => (
              <Text wrap="truncate-end">
                {line.map((s, i) => (
                  <Text>
                    {i > 0 && <Text>{SPLIT}</Text>}
                    <Text color={s.color} backgroundColor={s.background}>{`${s.glyph} `}</Text>
                    <Text dimColor={s.kind !== 'used'}>{`${s.name} `}</Text>
                    <Text bold={s.kind === 'used'}>{tokens(s.tokens)}</Text>
                    {s.kind === 'used' && <Text dimColor>{` ${share(s.tokens, r.window)}`}</Text>}
                  </Text>
                ))}
              </Text>
            ))}
        </Box>
        {rest}
      </Box>
    )
  })
}

// The close button: hides the bar as /compact-token-bar does, and keeps the choice.
async function hide($: EngineInterface) {
  await update($, isHidden, () => true)
  await $.store.set('isHidden', true).catch(() => {})
}

// Asks the engine for /context's breakdown, estimated locally (no token-count calls).
async function refresh($: EngineInterface) {
  if (await read($, isHidden)) return
  const usage = await $.session.usage({ breakdown: 'summary' })
  const b = usage.context.breakdown
  if (!b || !(b.rawMaxTokens > 0)) return // no window to measure against
  await update($, reading, () => toReading(b, usage.rateLimits))
}

export function toReading(b: {
  categories: { name: string; tokens: number; color: string; kind: string }[]
  totalTokens: number
  rawMaxTokens: number
  percentage: number
  autoCompactThreshold?: number
  isAutoCompactEnabled: boolean
}, rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[] = []): Reading {
  const slices: Slice[] = b.categories
    .filter(c => c.kind !== 'deferred' && c.tokens > 0)
    .map(c => ({ name: c.name.toLowerCase(), tokens: c.tokens, color: c.color, glyph: '', kind: c.kind as Slice['kind'] }))
  const order = { used: 0, free: 1, buffer: 2 }
  slices.sort((x, y) => order[x.kind] - order[y.kind]) // stable: used rows keep /context's order
  const ramped = slices.filter(c => c.kind === 'used' && c.name !== 'messages').length
  let next = 0
  for (const s of slices) {
    if (s.kind !== 'used') {
      s.color = s.kind === 'free' ? FREE : BUFFER
      s.glyph = GLYPH[s.kind]
    } else if (s.name === 'messages') {
      s.color = MESSAGES.color
      s.glyph = MESSAGES.glyph
      s.background = MESSAGES.background
    } else {
      s.color = ramp(next, ramped)
      s.glyph = TEXTURES[next % TEXTURES.length]!
      next++
    }
  }
  return {
    slices,
    total: b.totalTokens,
    window: b.rawMaxTokens,
    percent: b.percentage,
    compactsAt: b.isAutoCompactEnabled ? b.autoCompactThreshold : undefined,
    limits: rateLimits
      .filter((l): l is typeof l & { kind: keyof typeof LIMITS } => l.kind in LIMITS)
      .sort((x, y) => (x.kind === 'five_hour' ? -1 : 1) - (y.kind === 'five_hour' ? -1 : 1))
      .map(l => ({ kind: l.kind, percent: Math.round(l.percentUsed), resetsAt: l.resetsAt })),
  }
}

// The i-th of n colors along the slate ramp.
export function ramp(i: number, n: number) {
  const t = n <= 1 ? 0.5 : i / (n - 1)
  const [a, b] = RAMP.map(c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)))
  return `#${a!.map((v, k) => Math.round(v + (b![k]! - v) * t).toString(16).padStart(2, '0')).join('')}`
}

// " · remise à zéro dans 2 h 10" for a window's reset time, nothing when it is unknown or past.
export function resets(at: string | undefined, now: number) {
  const ms = at ? Date.parse(at) - now : NaN
  if (!(ms > 0)) return ''
  const min = Math.round(ms / 60_000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return ` · remise à zéro dans ${d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`}`
}

// The bar as runs of cells: each slice gets its share of `width`, a used one at least one cell.
export function cells(r: Reading, width: number) {
  const sizes = r.slices.map(s => Math.max(s.kind === 'used' ? 1 : 0, Math.round((s.tokens / r.window) * width)))
  // Rounding leaves the sum a few cells off: free space takes the difference first, then the largest slices.
  let diff = width - sizes.reduce((a, n) => a + n, 0)
  const isUsed = (i: number) => r.slices[i]!.kind === 'used'
  const order = r.slices.map((_, i) => i).sort((a, b) => Number(isUsed(a)) - Number(isUsed(b)) || sizes[b]! - sizes[a]!)
  for (const i of order) {
    if (diff === 0) break
    const size = Math.max(isUsed(i) ? 1 : 0, sizes[i]! + diff)
    diff -= size - sizes[i]!
    sizes[i] = size
  }
  return r.slices.map((s, i) => ({ color: s.color, kind: s.kind, slice: s, text: s.glyph.repeat(sizes[i]!) })).filter(c => c.text !== '')
}

// The legend, packed into lines no wider than `width`.
export function legend(r: Reading, width: number) {
  const lines: Slice[][] = [[]]
  let used = 0
  for (const s of r.slices) {
    const size = 2 + s.name.length + 1 + tokens(s.tokens).length + (s.kind === 'used' ? 1 + share(s.tokens, r.window).length : 0)
    const line = lines.at(-1)!
    if (line.length > 0 && used + SPLIT.length + size > width) {
      lines.push([s])
      used = size
    } else {
      used += (line.length > 0 ? SPLIT.length : 0) + size
      line.push(s)
    }
  }
  return lines.filter(l => l.length > 0)
}

export function tokens(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`
  return String(n)
}

export function share(n: number, window: number) {
  const p = (n / window) * 100
  if (p > 0 && p < 0.1) return '<0.1%'
  return `${p >= 10 ? Math.round(p) : +p.toFixed(1)}%`
}
