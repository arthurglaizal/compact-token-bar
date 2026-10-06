export type Slice = {
  name: string
  tokens: number
  color: string
  glyph: string // the texture the slice is drawn with, so the bar reads without color
  background?: string // a ground behind the glyphs, for the slice that has one
  kind: 'used' | 'free' | 'buffer'
}

export type Limit = {
  kind: 'five_hour' | 'seven_day' // the session window and the weekly one
  percent: number // used, 0 to 100
  resetsAt?: string // ISO 8601
}

export type Reading = {
  slices: Slice[]
  total: number // tokens in use
  window: number // the window measured against
  percent: number
  compactsAt?: number // where auto-compaction runs, when it is on
  limits: Limit[] // the rate-limit windows the last response reported; empty off a subscription
}

declare module 'claude-code' {
  interface PluginState {
    'compact-token-bar': { reading: Reading | null; isHidden: boolean; isExpanded: boolean }
  }
}
