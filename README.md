<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-token-bar/releases/download/v1.1.0/quiet-token-bar.gif" alt="Quiet Token Bar demo: the context bar above the Claude Code prompt" width="100%">
</p>

# Quiet Token Bar

> **Your context window in one quiet line, grey until it matters.**

A Claude Code mod that sits above the prompt and shows how full your context is, your session and weekly limits, and a one-click compact button.

It stays neutral by default. A figure only turns orange, then red, when it gets close to its limit.

## What it shows

The same single line comes in two designs.

**Desktop app**: the design in the demo above, and the reference. Small grey text, real stripes and dots drawn as SVG, tooltips on hover.

**Terminal**: the same line drawn with characters, at the terminal's own text size. It looks like this:

```txt
Context  ▆▆⠿⠿⠿⠿────────────▃   491k of 967k  51%  ≍  │ limit  9%  4%  ∨  ×
```

Tooltips are less reliable in a terminal, so nothing essential depends on them.

From left to right:

- **The bar**: what fills the window (system prompt, tools, MCP tools, memory files, skills, messages), then free space and the compaction buffer. Each category has its own pattern, so it reads without color.
- **The fill**: tokens used against the real limit, the point where auto-compaction runs, and the matching percentage.
- **Compact**: runs `/compact` for you, so the compaction shows in the conversation as if you had typed it.
- **Limits**: your 5-hour session and weekly usage, in that order. Hover for the full label and the reset time. A plan without a session window shows the weekly one alone.
- **Details**: the chevron unfolds a legend with each category's tokens and share.
- **Close**: hides the bar. Your choice is kept across sessions.

Everything is grey until a figure reaches 70% (orange), then 90% (red).

## How to use

Once installed, the bar appears above the prompt in every new session. It refreshes after each turn and after a compaction, from the same breakdown `/context` draws, estimated locally (no extra API calls).

| Action | How |
| --- | --- |
| Show or hide the bar | `/quiet-token-bar` |
| Compact now | the compact button after the percentage |
| See the details | the chevron |
| See what a segment or a limit is | hover it |

## Limitations

- Mods are a recent Claude Code feature: you need **Claude Code 2.1.287 or later**, and an update can change the mod API.
- Session and weekly limits appear only when you are signed in with a Claude subscription. They are known after the first response; until then the bar shows the last values seen, if they have not reset.
- If Claude is answering, the compact button's `/compact` waits until the answer is done.
- On desktop, widths are estimated from terminal columns, so spacing can shift slightly with the window size.

## Install in Claude Code

This repository is its own plugin marketplace.

```sh
claude plugin marketplace add arthurglaizal/quiet-token-bar
claude plugin install quiet-token-bar@arturo-mods
```

Or, in a Claude Code session:

```txt
/plugin marketplace add arthurglaizal/quiet-token-bar
/plugin install quiet-token-bar@arturo-mods
```

Start a new session and the bar appears above the prompt.

This mod was called Compact Token Bar before 1.1.0. If you installed it under that name, remove it first with `claude plugin uninstall compact-token-bar@arturo-mods`, then run `claude plugin marketplace update arturo-mods` and install it as above.

To try it without installing, clone the repository and run:

```sh
claude --plugin-dir ./quiet-token-bar
```

## Repository structure

```txt
quiet-token-bar/
├── README.md
├── LICENSE
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── hooks/
│   ├── hooks.json
│   └── register.tsx
├── types/index.d.ts
└── tests/quiet-token-bar.test.tsx
```

Run the checks with `claude plugin validate .` and `claude plugin test .`.

## Credits

Built on [context-bar](https://github.com/hamzafer/claude-code-mods) by Hamza Zafar (MIT), redesigned around a quieter, single-line layout.

## Support

If you find my work useful, you can [buy me a coffee](https://ko-fi.com/arturo_ux) ☕️

## License

MIT — see [LICENSE](LICENSE).
