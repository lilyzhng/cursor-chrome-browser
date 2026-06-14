# cursor-chrome-browser

**Give Cursor's Composer 2.5 the same "drive my real, logged-in browser" power that Claude-in-Chrome has — no extra API key, billed to your Cursor subscription.**

Everyone assumes only Claude can reach into your browser and operate the sites you're already
logged into. It's not a model capability gap. Composer 2.5 is natively multimodal and, in our
own testing, browses *better* than Sonnet 4.6. The only thing missing in the Cursor ecosystem is
the product wiring. This repo is that wiring: a ~10-line MCP config that points Composer at the
[Playwright MCP](https://github.com/microsoft/playwright-mcp) server in `--extension` mode, so the
agent drives **your actual Chrome with your actual logins**.

## What you get

- Composer opens and operates **any** website, not just Cursor's internal preview browser.
- It reuses the sessions you're **already logged into** — no re-login, no password prompts.
- **No separate model API key.** The browser tools are driven by the Composer model you already
  pay for; the MCP server is just a tool surface with no LLM of its own.
- One-click connect (same UX as Claude-in-Chrome's authorize step).

## Quickstart

### 1. Add the MCP server

Copy [`mcp.json`](./mcp.json) into `~/.cursor/mcp.json` (global) or your project's
`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--extension"]
    }
  }
}
```

### 2. Install the Playwright MCP Bridge extension

Restart Cursor. When the `playwright` server starts in `--extension` mode it prompts you to install
the **Playwright MCP Bridge** Chrome/Edge extension. Install it once.

### 3. Connect a logged-in tab (the one click)

Open a site you're already logged into, then click the bridge extension to connect that tab. From
here Composer drives your real browser with your real session. This is the exact analog of
Claude-in-Chrome's authorize-once step.

### 4. Drive it

In Composer, ask it to do something on that site — e.g. *"read my latest 3 Linear tickets and
summarize them"* — and watch it operate the logged-in page without asking you to sign in again.

## Verify it works (no GUI, no login needed)

`scripts/validate.sh` proves the toolchain + Composer 2.5 end-to-end **headlessly**, using a
throwaway browser profile and the public `example.com` (so it needs no login and won't touch your
real accounts):

```bash
./scripts/validate.sh
```

It runs `cursor-agent` with `--model composer-2.5` against a default (non-extension, headless)
Playwright MCP server and confirms the model can navigate, snapshot, and read live page content.
This isolates the "does the model + browser tooling work" question from the one manual step
(connecting your real tab) that only you can do in the GUI.

#### Validated output (2026-06-14)

```
==> Driving example.com with composer-2.5 (headless)
----- composer-2.5 output -----
Main <h1> heading: Example Domain
First sentence of the paragraph: This domain is for use in documentation
examples without needing permission.
-------------------------------
PASS: composer-2.5 drove the headless browser and read live page content.
```

Both strings match `curl https://example.com` verbatim — composer-2.5 actually read the live
page through the browser tools, it didn't make them up.

## How this compares

| Approach | Drives your real logins? | Weight | Notes |
|---|---|---|---|
| **Playwright MCP `--extension`** (this repo) | **Yes** — your real Chrome, one-click connect | Light (just an MCP server) | Best fit for "Composer operates logged-in sites" |
| Playwright MCP default profile | No — separate browser, log in again | Light | Simpler but a weaker story |
| Chrome DevTools MCP | Via CDP | Light | Google-official; strong for debug/perf, weak for general browsing |
| [browser-use](https://github.com/browser-use/browser-use) | Yes | **Heavy** | Full agent framework with its own LLM loop — wrong tool for augmenting Composer |
| CDP `--cdp-endpoint` | Was the obvious idea | Light | **Dropped:** Chrome 136+ silently ignores `--remote-debugging-port` on the default profile |

See [`docs/research.md`](./docs/research.md) for the full cross-validated research, sources, and why
each alternative was rejected.

## Troubleshooting

- **`playwright` server not loaded in `cursor-agent`** → it needs approval once:
  `cursor-agent mcp enable playwright`, then `cursor-agent mcp list` should show `ready`.
- **Bridge extension never prompts / tab won't connect** → make sure the `--extension` arg is
  present and you restarted Cursor after editing `mcp.json`. Extension mode only works with
  Chrome/Edge.
- **Don't try the old `--remote-debugging-port` + your default Chrome profile trick.** Since
  Chrome 136 (Apr 2025) Chrome silently ignores `--remote-debugging-port` on the default profile
  (anti-infostealer change), so the naive CDP path fails silently. Extension mode avoids it.
- **First run is slow** → `npx @playwright/mcp@latest` downloads on first use; subsequent runs
  are fast.

## Requirements

- macOS (the validation script and bridge flow are tested on macOS).
- Cursor with Composer 2.5, plus the `cursor-agent` CLI for the headless validation step.
- Node / `npx` (the Playwright MCP server runs via `npx @playwright/mcp@latest`).
