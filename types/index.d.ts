export type Slice = {
  name: string
  tokens: number
  color: string
  glyph: string // the texture the slice is drawn with, so the bar reads without color
  kind: 'used' | 'free' | 'buffer'
}

export type Reading = {
  slices: Slice[]
  total: number // tokens in use
  window: number // the window measured against
  percent: number
  compactsAt?: number // where auto-compaction runs, when it is on
}

declare module 'claude-code' {
  interface PluginState {
    'compact-claude-token': { reading: Reading | null; isHidden: boolean; isExpanded: boolean }
  }
}
