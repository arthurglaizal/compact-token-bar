// Compact Claude Token: what is filling my context window?
//   Fork of context-bar (hamzafer/claude-code-mods, MIT). Above the prompt, the window as one
//   stacked bar in a neutral slate ramp. On the desktop the header and the bar are one SVG (small text,
//   striped categories, dotted messages); in a terminal, glyphs. Hovering a segment shows its label.
//   The legend is folded by default: the chevron opens it. The header also shows the session and
//   weekly limits; everything stays grey until a figure gets warm.
//   /compact-token-bar shows or hides the bar, and the choice is kept across sessions.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Reading, Slice } from '../types'

const MIN_WIDTH = 20 // narrower than this, the bar is not drawn
const SPLIT = '   '
// One slate ramp, dark to light, spread over the used categories; the texture keeps neighbours apart.
const RAMP = ['#4c5568', '#868fa0'] as const
// Lower blocks, so the bar is a little shorter than a line of text and has no gaps between neighbours.
// Used rows are solid, messages (the row that grows) are quiet dots, the buffer a low band.
const USED = '▆'
const MESSAGES = { color: '#5d6370', glyph: '⠿', ground: '#26282c' } as const // small dots in quincunx on a barely lighter ground
const FREE = '#808080' // a mid grey thin line reads as empty on dark and light themes alike
const BUFFER = '#808080'
const GLYPH = { free: '─', buffer: '▃' } as const
// The windows, session first then week; the line shows their figures alone and the hover names them.
const LIMITS = { five_hour: { label: 'Session limit (5 h)' }, seven_day: { label: 'Weekly limit (7 days)' } } as const
const ORANGE = '#e08a3c'
const CHEVRON = { closed: '∨', open: '∧' } as const // thin chevrons, the same weight as the close cross: down to open, up to fold

// Held by the host, so the bar survives a hot reload of this file.
const reading = atom({ plugin: 'compact-token-bar', key: 'reading' } as const, null as Reading | null)
const isHidden = atom({ plugin: 'compact-token-bar', key: 'isHidden' } as const, false)
const isExpanded = atom({ plugin: 'compact-token-bar', key: 'isExpanded' } as const, false)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'compact-token-bar', description: 'Show or hide the context window bar above the prompt' }).catch(() => {}) // a name Claude Code already has is refused: start anyway
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
    return { text: hidden ? 'Context bar hidden. /compact-token-bar shows it again' : 'Context bar on' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e) // what other mods and Claude Code draw here stays
    const r = await read($, reading)
    if (e.props.hasSurvey || (await read($, isHidden)) || !r) return rest
    const { Box, Text, Button } = $.ui.resolve(e)
    const inner = e.props.bodyColumns - 2 // no border: the padding takes 2 cells
    if (inner < MIN_WIDTH) return rest
    const open = await read($, isExpanded)

    const { head, percent, level } = fill(r)
    const heat = level >= 0.9 ? 'red' : level >= 0.7 ? ORANGE : undefined // grey until it gets warm
    const barWidth = inner - 3 // the fold chevron takes the end of the line
    const now = await $.clock.now()
    // A segment grows in proportion to its cells and the glyphs are cut to fit: a font whose glyphs are not
    // one cell wide (the desktop) then never wraps the bar onto a second line.
    let at = 0 // the column a segment starts at, to anchor its label on the side with room
    // The terminal draws the bar in glyphs; the surfaces that have a vector element draw the header and the
    // bar as one SVG, with small text and real stripes and dots.
    const Svg = (e.surface === 'terminal' ? undefined : ($.ui.resolve(e) as any).Svg) as ((props: { source: string; alt: string }) => any) | undefined
    if (Svg) {
      // One flex row, so nothing overlaps: the title and the bar, then the figures, the compact button, the
      // limits and the two card buttons, each a box of its own. Only the bar's width is estimated.
      const drawn = Math.round((inner - 6) * PX_PER_COLUMN) // the chevron and the cross take the last six cells
      const { context, limits } = figures(r)
      const contextWidth = Math.ceil(spanWidth(context)) + 4
      const limitsWidth = limits.length ? Math.ceil(spanWidth(limits)) + 4 : 0
      const rowWidth = Math.max(160, drawn - contextWidth - limitsWidth - Math.round(4 * PX_PER_COLUMN))
      const barX = titleWidth()
      const col = (px: number) => Math.round(px / PX_PER_COLUMN)
      const barCols = Math.max(1, col(rowWidth - barX))
      let from = 0
      // A button of the card: a stroked icon in the text's grey, centered in its own box, an empty button over
      // the whole box so the hover area sits right around the icon, and a short tooltip.
      const iconButton = (b: { key: string; icon: string; tip: string; press: () => void }) => (
        <Box key={`${b.key}-box`} width={2} height={1} justifyContent="center" alignItems="center">
          <Svg source={b.icon} alt={b.tip} width={12} height={12} />
          <Box position="absolute" top={0} left={0} width={2} height={1}>
            <Button key={b.key} plain onPress={b.press}>
              {'\u00A0\u00A0'}
            </Button>
          </Box>
          <Box position="absolute" top={1} right={0} display="none" hover={{ display: 'flex' }}>
            <Text color={TIP.name} wrap="truncate-end">{b.tip}</Text>
          </Box>
        </Box>
      )
      return (
        <Box flexDirection="column">
          <Box flexDirection="column" paddingX={1}>
            <Box flexDirection="row" alignItems="center">
              <Box flexShrink={1}>
                <Svg source={barRowSvg(r, rowWidth)} alt={barAlt(r)} />
                {/* A picture has no hover of its own: empty keyed boxes lie over the bar and reveal the labels. */}
                <Box position="absolute" top={0} left={col(barX)} width={barCols} flexDirection="row" height={1}>
                  {cells(r, barCols).map((c, i) => {
                    const onRight = from + c.text.length / 2 > barCols / 2
                    from += c.text.length
                    return (
                      <Box key={`hit-${i}`} width={0} flexGrow={c.text.length} height={1}>
                        <Box width={0} flexGrow={1} height={1} overflow="hidden">
                          <Text wrap="wrap">{'\u00A0'.repeat(200)}</Text>
                        </Box>
                        {/* A classic tooltip, floated above the line by the app: the name, tokens and share in soft
                            greys. No pattern: the app draws no picture in a floating tooltip. */}
                        <Box position="absolute" top={1} {...(onRight ? { right: 0 } : { left: 0 })} display="none" hover={{ display: 'flex' }}>
                          <Text wrap="truncate-end">
                            <Text color={TIP.name}>{`${c.slice.name} `}</Text>
                            <Text color={TIP.figure} bold>{tokens(c.slice.tokens)}</Text>
                            <Text color={TIP.dim}>{` ${share(c.slice.tokens, r.window)}`}</Text>
                          </Text>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
              <Box flexGrow={1} />
              <Svg source={spansSvg(context, contextWidth)} alt={context.map(x => x.text).join(' ')} />
              <Box marginLeft={1}>
                {iconButton({ key: 'compact', icon: icon('compact'), tip: 'Compact the conversation now', press: () => void compactNow($) })}
              </Box>
              {limits.length > 0 && (
                <Box key="limits" marginLeft={1}>
                  <Svg source={spansSvg(limits, limitsWidth)} alt={limits.map(x => x.text).join(' ')} />
                  <Box position="absolute" top={1} right={0} display="none" hover={{ display: 'flex' }}>
                    <Text wrap="truncate-end">
                      {r.limits.map((l, i) => (
                        <Text>
                          {i > 0 && <Text color={TIP.dim}>{'   '}</Text>}
                          <Text color={TIP.name}>{`${LIMITS[l.kind].label} `}</Text>
                          <Text color={TIP.figure} bold>{`${l.percent}%`}</Text>
                          <Text color={TIP.dim}>{`${resets(l.resetsAt, now)}`}</Text>
                        </Text>
                      ))}
                    </Text>
                  </Box>
                </Box>
              )}
              <Box marginLeft={1}>
                {iconButton({ key: 'toggle-legend', icon: icon(open ? 'up' : 'down'), tip: open ? 'Hide details' : 'Show details', press: () => void update($, isExpanded, v => !v) })}
              </Box>
              <Box marginLeft={1}>
                {iconButton({ key: 'close', icon: icon('close'), tip: 'Close (/compact-token-bar brings it back)', press: () => void hide($) })}
              </Box>
            </Box>
            {open && <Svg source={legendSvg(r, drawn)} alt={legendAlt(r)} />}
          </Box>
          {rest}
        </Box>
      )
    }
    const bar = (
      <Box flexDirection="row" flexGrow={1}>
              {cells(r, barWidth).map((c, i) => {
                const onRight = at + c.text.length / 2 > barWidth / 2
                at += c.text.length
                return (
                  <Box key={`seg-${i}`} width={0} flexGrow={c.text.length} height={1}>
                    {/* the glyphs overshoot and are clipped, so no ellipsis ends a short segment */}
                    <Box width={0} flexGrow={1} height={1} overflow="hidden">
                      <Text color={c.color} wrap="wrap">{c.text.repeat(3)}</Text>
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
    )
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text dimColor>Context</Text>
            <Box flexDirection="row">
              <Text dimColor wrap="truncate-start">{head}</Text>
              <Box marginLeft={2}>
                {heat ? <Text bold color="black" backgroundColor={heat}>{` ${percent}% `}</Text> : <Text dimColor>{`${percent}%`}</Text>}
              </Box>
              {r.limits.length > 0 && (
                <Box marginLeft={2}>
                  <Text dimColor>{'│  limit'}</Text>
                </Box>
              )}
              {r.limits.map(l => {
                const hot = l.percent >= 90 ? 'red' : l.percent >= 70 ? ORANGE : undefined
                return (
                  <Box key={`limit-${l.kind}`} marginLeft={2}>
                    <Text dimColor={!hot} color={hot}>{`${l.percent}%`}</Text>
                    <Box position="absolute" top={1} right={0} display="none" hover={{ display: 'flex' }}>
                      <Text bold color="black" backgroundColor="white" wrap="truncate-end">
                        {` ${LIMITS[l.kind].label} · ${l.percent}% used${resets(l.resetsAt, now)} `}
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
            {bar}
            <Box marginLeft={1}>
              <Button key="toggle-legend" plain onPress={() => void update($, isExpanded, v => !v)}>
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
                    <Text color={s.color}>{`${s.glyph} `}</Text>
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

// The desktop card, in CSS pixels: the engine gives columns, not pixels, so the drawing is sized at an
// estimate of a column's width; a drawing wider than its slot is scaled down to fit.
const PX_PER_COLUMN = 8.4
const FONT = 11
const TITLE_FONT = 13 // the title a little larger than the figures
const ROW = 20 // the height of the card's line
const BAR_HEIGHT = 15 // a multiple of the dots' step, so no row of dots is cut
const DOT_STEP = 8 // dots in quincunx: one high, one low, every 8 px
const CHAR_WIDTH = 6.1 // an estimate of a character's width at FONT, to leave the figures their room
const TEXT = '#8b8b90'
const SWATCH = { width: 24, height: BAR_HEIGHT } // a strip of the bar at its own scale, for the tooltips
const TIP = { name: '#b9b9be', figure: '#e2e2e6', dim: '#7d7d83' } // the tooltips' soft greys, on the app's dark card
const FONTS = "-apple-system, 'SF Pro Text', system-ui, sans-serif"

// "#rrggbb" mixed with the dark of the card, t in 0..1 of the way to it.
function darken(hex: string, t: number) {
  const dark = [0x1c, 0x1c, 0x1e]
  return `#${[1, 3, 5].map((k, i) => Math.round(parseInt(hex.slice(k, k + 2), 16) * (1 - t) + dark[i]! * t).toString(16).padStart(2, '0')).join('')}`
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function barAlt(r: Reading) {
  return `Context window: ${tokens(r.total)} of ${tokens(r.window)} used. ${r.slices.filter(s => s.kind === 'used').map(s => `${s.name} ${share(s.tokens, r.window)}`).join(', ')}`
}

// The fill a slice is drawn with, as a <pattern> under `id`: each used category stripes at its own angle,
// messages dots, the compaction buffer a hatch. The bar and the legend share it, so they always match.
export function pattern(r: Reading, s: Slice, id: string, y = 0) {
  if (s.kind === 'free') return { def: '', fill: FREE }
  if (s.kind === 'buffer') {
    return { def: `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="4" fill="${BUFFER}"/></pattern>`, fill: `url(#${id})` }
  }
  if (s.name === 'messages') {
    // Dots in quincunx; the tile starts where the shape does and is as tall as the bar, so no dot is cut.
    return { def: `<pattern id="${id}" x="0" y="${y}" width="${DOT_STEP}" height="${BAR_HEIGHT}" patternUnits="userSpaceOnUse"><rect width="${DOT_STEP}" height="${BAR_HEIGHT}" fill="${MESSAGES.ground}"/><circle cx="${DOT_STEP / 4}" cy="4" r="0.9" fill="${MESSAGES.color}"/><circle cx="${(DOT_STEP * 3) / 4}" cy="11" r="0.9" fill="${MESSAGES.color}"/></pattern>`, fill: `url(#${id})` }
  }
  const angles = [45, 135, 0, 90]
  const k = r.slices.filter(x => x.kind === 'used' && x.name !== 'messages').indexOf(s)
  return { def: `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${angles[Math.max(0, k) % angles.length]})"><rect width="5" height="5" fill="${darken(s.color, 0.45)}"/><rect width="2.5" height="5" fill="${s.color}"/></pattern>`, fill: `url(#${id})` }
}

// The bar alone, `width` by `height`, at (left, y).
function barParts(r: Reading, width: number, y: number, height: number, left = 0) {
  const defs: string[] = []
  const parts: string[] = []
  let at = 0
  cells(r, 1000).forEach((c, i) => {
    const x = left + (at * width) / 1000
    const w = (c.text.length * width) / 1000
    at += c.text.length
    const tip = `<title>${esc(`${c.slice.name} · ${tokens(c.slice.tokens)} · ${share(c.slice.tokens, r.window)}`)}</title>`
    if (c.kind === 'free') {
      parts.push(`<g>${tip}<rect x="${x}" y="${y + height / 2 - 0.5}" width="${w}" height="1" fill="${FREE}"/></g>`)
      return
    }
    const p = pattern(r, c.slice, `p${i}`, y)
    defs.push(p.def)
    parts.push(`<g>${tip}<rect x="${x}" y="${y}" width="${w}" height="${height}" fill="${p.fill}"/></g>`)
  })
  return { defs: defs.join(''), parts: parts.join('') }
}

// The bar as one SVG, `height` tall and drawn 1800 wide.
export function barSvg(r: Reading, height: number) {
  const { defs, parts } = barParts(r, 1800, 0, height)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${height}" viewBox="0 0 1800 ${height}"><defs>${defs}</defs>${parts}</svg>`
}

// How full the window is, against the real limit: the point where auto-compaction runs, or the whole
// window when it is off. "371k of 967k", 38%.
export function fill(r: Reading) {
  const limit = r.compactsAt ?? r.window
  const level = r.total / limit
  return { head: `${tokens(r.total)} of ${tokens(limit)}`, percent: Math.round(level * 100), level }
}

// The card's button icons, 12 px, stroked in the text's grey: the chevron of the person's own drawing
// (a 24 grid, scaled by half) pointing down to open and up to fold, and a cross of the same stroke.
export function icon(kind: 'down' | 'up' | 'close' | 'compact') {
  // compact: two chevrons closing on a line, the conversation folded down.
  const d = { down: 'm4 9l8 8l8-8', up: 'm4 15l8-8l8 8', close: 'M6 6l12 12M18 6L6 18', compact: 'M7 3l5 5l5-5M7 21l5-5l5 5M4 12h16' }[kind]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="${TEXT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

// The figures of the line, as spans with the gap before each: the context's fill, then the limits.
export function figures(r: Reading) {
  const { head, percent, level } = fill(r)
  const heat = (v: number) => (v >= 0.9 ? '#e5534b' : v >= 0.7 ? ORANGE : undefined)
  const context: Span[] = [
    { text: head, gap: 0 },
    { text: `${percent}%`, gap: 12, color: heat(level) },
  ]
  const limits: Span[] = r.limits.length === 0 ? [] : [
    { text: '│', gap: 0 },
    { text: 'limit', gap: 10 },
    ...r.limits.map(l => ({ text: `${l.percent}%`, gap: 10, color: heat(l.percent / 100) })), // which is which: the hover says
  ]
  return { context, limits }
}

type Span = { text: string; gap: number; color?: string }

export const spanWidth = (ss: Span[]) => ss.reduce((w, x) => w + x.gap + x.text.length * CHAR_WIDTH, 0)

const titleWidth = () => Math.round('Context'.length * CHAR_WIDTH * (TITLE_FONT / FONT) + 14)

const svgOpen = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONTS}" font-size="${FONT}">`

// Spans of small grey text, right-aligned in a box `width` wide: any slack in the estimate becomes space on
// the left, never an overlap.
export function spansSvg(spans: Span[], width: number) {
  const body = spans
    .map(x => `<tspan${x.gap ? ` dx="${x.gap}"` : ''} fill="${x.color ?? TEXT}"${x.color ? ' font-weight="600"' : ''}>${esc(x.text)}</tspan>`)
    .join('')
  return `${svgOpen(width, ROW)}<text x="${width}" y="14" text-anchor="end" xml:space="preserve">${body}</text></svg>`
}

// The title and the bar, `width` wide: "Context", then the bar in the rest of the room.
export function barRowSvg(r: Reading, width: number) {
  const barX = titleWidth()
  const { defs, parts } = barParts(r, Math.max(20, width - barX), (ROW - BAR_HEIGHT) / 2, BAR_HEIGHT, barX)
  return `${svgOpen(width, ROW)}<defs>${defs}</defs><text x="0" y="14" fill="${TEXT}" font-size="${TITLE_FONT}">Context</text>${parts}</svg>`
}

// The legend alone, `width` wide, its swatches drawn with the bar's own patterns.
export function legendSvg(r: Reading, width: number) {
  const { defs, parts, height } = legendParts(r, width, 6)
  return `${svgOpen(width, height + 6)}<defs>${defs}</defs>${parts}</svg>`
}

export function legendAlt(r: Reading) {
  return r.slices.map(s => `${s.name} ${tokens(s.tokens)}`).join(', ')
}

// A reminder of a segment's pattern in text, for the tooltips (a picture does not show there): a short
// strip of three glyphs at about the bar's own scale. Stripes at the bar's angle (rotate 45 leans like "/",
// 135 like "\", 0 stands, 90 lies), dots for messages, a hatch for the buffer, a line for free space.
export function swatchGlyph(r: Reading, s: Slice) {
  if (s.kind === 'free') return '───'
  if (s.kind === 'buffer') return '╱╱╱'
  if (s.name === 'messages') return '⠑⠑⠑'
  const k = r.slices.filter(x => x.kind === 'used' && x.name !== 'messages').indexOf(s)
  return ['╱╱╱', '╲╲╲', '│││', '═══'][Math.max(0, k) % 4]!
}


const LEGEND_LINE = 21 // a swatch as tall as the bar, and a little air
const CHAR = 6.4 // an estimate of a character's width at FONT, generous so items never overlap

// The legend from `top`: each slice a swatch, its name, tokens and share, packed into lines of `width`.
function legendParts(r: Reading, width: number, top: number) {
  const defs: string[] = []
  const parts: string[] = []
  let x = 0
  let line = 0
  r.slices.forEach((s, i) => {
    const words = `${s.name} ${tokens(s.tokens)}${s.kind === 'used' ? ` ${share(s.tokens, r.window)}` : ''}`
    const w = SWATCH.width + 6 + words.length * CHAR
    if (x > 0 && x + w > width) {
      x = 0
      line++
    }
    const y = top + line * LEGEND_LINE
    if (s.kind === 'free') {
      parts.push(`<rect x="${x}" y="${y + SWATCH.height / 2 - 0.5}" width="${SWATCH.width}" height="1" fill="${FREE}"/>`)
    } else {
      const p = pattern(r, s, `l${i}`, y)
      defs.push(p.def)
      parts.push(`<rect x="${x}" y="${y}" width="${SWATCH.width}" height="${SWATCH.height}" fill="${p.fill}"/>`) // the same strip as the tooltips'
    }
    const isUsed = s.kind === 'used'
    parts.push(
      `<text x="${x + SWATCH.width + 6}" y="${y + 11}" xml:space="preserve">` +
        `<tspan fill="${isUsed ? '#c4c4c9' : TEXT}">${esc(s.name)} </tspan>` +
        `<tspan fill="${isUsed ? '#e8e8ea' : TEXT}"${isUsed ? ' font-weight="600"' : ''}>${tokens(s.tokens)}</tspan>` +
        (isUsed ? `<tspan fill="${TEXT}"> ${esc(share(s.tokens, r.window))}</tspan>` : '') + // escaped: "<0.1%" would break the markup
        `</text>`,
    )
    x += w + 18
  })
  return { defs: defs.join(''), parts: parts.join(''), height: 8 + (line + 1) * LEGEND_LINE - 6 }
}

// A swatch for the tooltips: a strip of the slice's own fill, at the bar's scale, as in the legend.
export function swatchSvg(r: Reading, s: Slice) {
  const { width, height } = SWATCH
  const p = s.kind === 'free' ? { def: '', fill: '' } : pattern(r, s, `s${r.slices.indexOf(s)}`) // ids unique per slice, should two swatches ever share a page
  const body = s.kind === 'free' ? `<rect x="0" y="${height / 2 - 0.5}" width="${width}" height="1" fill="${FREE}"/>` : `<rect width="${width}" height="${height}" fill="${p.fill}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${p.def}</defs>${body}</svg>`
}

// The compact button: compacts the conversation as /compact does. Between turns only; the engine refuses it
// while a turn runs, and this plugin's own session.compact hook does not see its own call, so it refreshes.
async function compactNow($: EngineInterface) {
  const say = (text: string) => {
    try {
      void $.ui.toast(text)
    } catch {}
  }
  say('Compacting the conversation…')
  try {
    const done = await $.session.compact()
    if (done && 'skip' in done && done.skip) return say('Compaction was skipped')
  } catch {
    return say('Compaction runs between turns: try again once Claude is done')
  }
  await refresh($).catch(() => {})
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
    } else {
      s.color = ramp(zigzag(next, ramped), ramped)
      s.glyph = USED
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

// The order the ramp is walked in: dark, light, a bit less dark, a bit less light... so neighbours differ.
export function zigzag(k: number, n: number) {
  return k % 2 === 0 ? k / 2 : Math.ceil(n / 2) + (k - 1) / 2
}

// The i-th of n colors along the slate ramp.
export function ramp(i: number, n: number) {
  const t = n <= 1 ? 0.5 : i / (n - 1)
  const [a, b] = RAMP.map(c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)))
  return `#${a!.map((v, k) => Math.round(v + (b![k]! - v) * t).toString(16).padStart(2, '0')).join('')}`
}

// " · resets in 2 h 10" for a window's reset time, nothing when it is unknown or past.
export function resets(at: string | undefined, now: number) {
  const ms = at ? Date.parse(at) - now : NaN
  if (!(ms > 0)) return ''
  const min = Math.round(ms / 60_000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return ` · resets in ${d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`}`
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
