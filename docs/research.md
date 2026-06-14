# Giving Cursor (Composer) the ability to drive any website — research & build plan

> Platform: **macOS only.**
> Every claim below carries an inline source link. Full list at the bottom.

## Goal

**Why Cursor (not Claude-in-Chrome):** This is a demonstration / content play, not just
private automation. Composer 2.5 benchmarked far better than Sonnet 4.6 in yesterday's
comparison, and it's natively multimodal — but the Cursor ecosystem lacks the product support
Claude has. Goal: **fill that gap by showing Composer 2.5 can do the same computer-browsing that
Claude-in-Chrome does**, billed to the Cursor subscription. Success = others can reproduce it and
are convinced, not just "it works for me."

Let Cursor's Composer agent open and operate **any** website (not just Cursor's
internal IDE browser), while **reusing the browser sessions I'm already logged into**
(so it doesn't get stuck on login/password prompts). Constraints:

- No using my own model API key — drive it through my existing Cursor subscription.
- Not heavyweight. Prefer a thin tool layer over a full second agent framework.
- Architecture like the Claude-in-Chrome extension: a tool surface that an agent connects to.

## Background / what we learned

**Cursor's built-in browser is the limitation.** Cursor (2.0+) has native browser control
where the agent opens and controls a Chromium browser via the Chrome DevTools Protocol,
embedded in a Cursor tab or as a separate window ([Cursor blog](https://cursor.com/blog/cursor-3);
[EPAM review of the IDE browser tool](https://www.epam.com/insights/ai/blogs/composer-ide-browser-tool-review)).
It's aimed at dev-preview use — letting a coding agent open the page it just shipped and
see it ([Cursor blog](https://cursor.com/blog/cursor-3)) — so it runs its own browser
context rather than freely browsing arbitrary sites under my real logged-in session.

**Claude in Chrome — the mental model.** It's a Chrome **extension**, distributed and run
through official channels as a beta product ([Claude Code → Chrome docs](https://code.claude.com/docs/en/chrome)).
It exposes a set of browser-control tools that a model drives — the reverse-engineered
clone documents it as the **same 18 MCP tools** as the official extension
([noemica-io/open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome)).
So "a plugin / tool layer an agent connects to" is the right mental model. The caveat: the
*official* extension is tied to Anthropic's own clients and isn't an open MCP server I can
point Cursor at; the open clone unbundles it but is Claude-specific and uses your own API
key ([noemica-io/open-claude-in-chrome](https://github.com/noemica-io/open-claude-in-chrome))
— not what I want.

**The right shape for me = an MCP server.** Cursor supports MCP configuration, and
Playwright MCP documents an explicit Cursor setup path
([Playwright MCP docs](https://playwright.dev/mcp/configuration/browser-extension)).
Adding a browser-automation MCP server gives Composer browser tools natively — no second
LLM, no separate API key.

## Options compared

| Option | What it is | Reuses my logins? | Weight | Fit |
|---|---|---|---|---|
| **Playwright MCP** ([repo](https://github.com/microsoft/playwright-mcp)) | MCP server wrapping Playwright | **Yes** — `--extension` reuses my logged-in sessions, cookies, and installed extensions; `--cdp-endpoint` attaches to my real profile ([docs](https://playwright.dev/mcp/configuration/browser-extension)) | Light (just an MCP server) | **Best fit** |
| Chrome DevTools MCP ([repo](https://github.com/ChromeDevTools/chrome-devtools-mcp)) | Google-official MCP over CDP, exposing screenshots/console/network/Lighthouse ([Webfuse roundup](https://www.webfuse.com/blog/the-top-5-best-mcp-servers-for-ai-agent-browser-automation)) | Yes (CDP) | Light | Strong for debugging/perf, weak for general browsing ([Webfuse roundup](https://www.webfuse.com/blog/the-top-5-best-mcp-servers-for-ai-agent-browser-automation)) |
| browser-use ([repo](https://github.com/browser-use/browser-use)) | Full Python AI-agent framework on Playwright (83.5k★, `Agent`+`Browser`+LLM loop) ([repo](https://github.com/browser-use/browser-use)) | Yes — "real browser profile" example reuses my Chrome profile with saved logins ([example](https://github.com/browser-use/browser-use/blob/main/examples/browser/real_browser.py)) | **Heavy** — its own agent loop + its own LLM ([repo](https://github.com/browser-use/browser-use)) | Overkill here; good for standalone autonomous tasks |

## Recommendation

**Use Playwright MCP in `--extension` mode, wired into Cursor via `mcp.json`.** It's the
lightest thing that gives Composer "operate any site with my existing logins" — the
extension mode is documented to reuse logged-in sessions, cookies, and installed extensions
([Playwright MCP docs](https://playwright.dev/mcp/configuration/browser-extension)) — and
it's a standard MCP server, recommended as the best local default for browser automation
([Webfuse roundup](https://www.webfuse.com/blog/the-top-5-best-mcp-servers-for-ai-agent-browser-automation)).

(CDP mode via `--cdp-endpoint` was considered as a fallback but **dropped**: since Chrome
136, `--remote-debugging-port` is silently ignored against the default profile, so the
naive "relaunch my real Chrome with debugging" path fails silently. Extension mode is the
clean path and needs no such workaround.)

Keep browser-use in the back pocket for a future "fully autonomous, runs on its own" use
case, since it's a full agent framework rather than a thin tool layer
([browser-use repo](https://github.com/browser-use/browser-use)) — not for augmenting Composer.

---

## Build plan (macOS) — shipped as the `cursor-chrome-browser` repo

### Architecture — Extension mode (drive my real, already-logged-in Chrome)

Extension mode = drive my **own real Chrome** with my **existing logins**; I connect a tab
through the Playwright MCP Bridge extension with **one click** (acceptable). This is the true
analog of Claude-in-Chrome, which matches the demo's narrative ("Composer 2.5 does what
Claude-in-Chrome does"). The default-persistent-profile alternative (separate browser, log in
again) was rejected: weaker story, not "my existing logins."

### Who executes what

- **Agent (automatable):** write the `playwright` server into `~/.cursor/mcp.json` (the prior
  **Descript** server was removed — not in use), then run `cursor-agent --model composer-2.5`
  headless to validate the toolchain end-to-end on a **public** site. `composer-2.5` is confirmed
  available in `cursor-agent --list-models`, so the validation exercises the exact model demoed.
- **Lily (one-time, in GUI — this IS the demo recording):** install the bridge extension, click
  once to connect a logged-in tab, then have Composer read authenticated-only content. The bridge
  tab-connect is a GUI action a headless agent cannot perform.

### Steps

Source: [Playwright MCP docs](https://playwright.dev/mcp/configuration/browser-extension).

1. Write `~/.cursor/mcp.json` (Descript dropped):

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

2. Headless validation (no login, throwaway profile) — `scripts/validate.sh` in the repo runs a
   default (non-extension, `--headless --isolated`) Playwright MCP server through `cursor-agent`:

   ```bash
   cursor-agent --print --force --approve-mcps --trust --model composer-2.5 \
     "Use the playwright browser MCP tools to open https://example.com and report the <h1> and first paragraph."
   ```

3. **[Lily, GUI]** Install the Playwright MCP Bridge extension when prompted; restart Cursor;
   confirm `playwright` shows green in Settings → MCP.
4. **[Lily, GUI — demo]** Click once to connect a tab I'm already logged into, then ask Composer
   to read something only visible when authenticated — confirm it does NOT ask me to log in again.

### Validation result (2026-06-14) — PASS

Ran step 2 for real. `composer-2.5` via `cursor-agent`, driving a headless Playwright MCP browser,
navigated to `example.com` and read back, **verbatim from the live page** (cross-checked against
`curl https://example.com`):
- `<h1>`: "Example Domain"
- paragraph: "This domain is for use in documentation examples without needing permission. Avoid use in operations."

This confirms the toolchain + the exact demo model work end-to-end. The only unautomated piece is
the one-click bridge tab-connect (step 4), which is the demo recording itself.

### Verification checklist
- [x] MCP server loads for `cursor-agent` (`playwright: ready`).
- [x] Composer (composer-2.5) can navigate to an arbitrary URL.
- [x] Composer can read page content (verified verbatim vs live page).
- [ ] An authenticated-only page loads without a fresh login. *(step 4, GUI demo — Lily)*
- [ ] MCP server shows green in Cursor GUI Settings → MCP. *(step 3 — Lily)*

### Notes / cautions
- Reusing my real profile means the agent acts as logged-in me — scope what it's allowed
  to do, and watch out for destructive actions on real accounts.
- If I later need stealth / CAPTCHA / many parallel sessions, that's the point to look at a
  cloud option (e.g. Browserbase for cloud scale) rather than the local setup
  ([Webfuse roundup](https://www.webfuse.com/blog/the-top-5-best-mcp-servers-for-ai-agent-browser-automation)).

## Cross-validation (2026-06-14) — what holds, what breaks

Fact-checked against official docs. Two real issues found.

**❌ Why CDP mode was dropped (Chrome 136+ security change).** Since Chrome 136 (Apr 2025), `--remote-debugging-port` is **silently ignored when pointed at the default `--user-data-dir`** — a deliberate anti-infostealer measure. So a "relaunch my real Chrome with `--remote-debugging-port=9222`" workflow fails silently against the default profile. Not worth the workaround when extension mode is clean. ([Chrome blog](https://developer.chrome.com/blog/remote-debugging-port))

**⚠️ "Reuses my EXISTING sessions" is overstated — but the goal still works.** `--extension` mode does NOT hijack your live Chrome. You install the official **Playwright MCP Bridge** extension once, then connect specific tabs through it; those tabs carry your real logins/cookies. The plain default (no flag) Playwright MCP launches a **separate persistent profile** (`~/Library/Caches/ms-playwright/mcp-*`) where you start logged-out and log in once (state then persists). Net: login reuse is real, the mechanism is "connect a tab via the bridge extension," not "auto-attach to everything." ([Playwright MCP docs](https://playwright.dev/mcp/configuration/browser-extension))

**✅ Confirmed.** Cursor MCP via `~/.cursor/mcp.json` → tools driven by the Composer model, no second LLM, no extra API key for a generic browser MCP. browser-use is genuinely a full agent framework (own perceive→LLM→act loop) — wrong tool for augmenting Composer. Chrome DevTools MCP is Google-official, CDP-based, strong for debug/perf, weak for general browsing.

**Note — Cursor's native Browser tool is NOT enough for this goal.** Cursor 2.0+ ships a built-in browser the agent drives directly (zero setup), but it's geared at testing *the app you're building*, not arbitrary logged-in third-party sites. The actual goal here — operate any third-party site under my existing logins — is exactly the gap Playwright MCP `--extension` fills, so the native tool doesn't replace it.

**Most elegant path for this goal:** **Playwright MCP `--extension`** — install the bridge extension once, cleanest reuse of real logins, sidesteps the Chrome 136 CDP trap entirely. (Chrome DevTools MCP only if you later want deep debug/perf work.)

## Risks
- **Agent acts as logged-in me.** In extension mode Composer operates my real session, so a bad
  instruction could take destructive actions on real accounts. Mitigation for the demo: I'm
  present and only connect a low-stakes tab. No hard guardrail (which-sites allowlist) was added —
  accepted for a controlled demo, revisit before any unattended use.
- **`npx @playwright/mcp@latest` pulls latest on first run.** First connect can be slow or version
  may drift for others reproducing it. Accepted for reproducibility parity (everyone gets latest);
  pin a version if a demo needs determinism.

## Source links
- Cursor — Meet the new Cursor (native browser integration): https://cursor.com/blog/cursor-3
- EPAM — Cursor/Composer IDE browser tool review: https://www.epam.com/insights/ai/blogs/composer-ide-browser-tool-review
- Cursor 3.5 IDE guide (2026): https://codersera.com/blog/cursor-ide-complete-guide-2026/
- Claude Code — Use Claude Code with Chrome (beta): https://code.claude.com/docs/en/chrome
- open-claude-in-chrome (same 18 MCP tools, reference only): https://github.com/noemica-io/open-claude-in-chrome
- Playwright MCP (repo): https://github.com/microsoft/playwright-mcp
- Playwright MCP — connecting to browsers / extension + CDP config: https://playwright.dev/mcp/configuration/browser-extension
- Chrome DevTools MCP (repo): https://github.com/ChromeDevTools/chrome-devtools-mcp
- Webfuse — 5 best MCP servers for browser automation (2026): https://www.webfuse.com/blog/the-top-5-best-mcp-servers-for-ai-agent-browser-automation
- browser-use (repo): https://github.com/browser-use/browser-use
- browser-use — real browser profile auth example: https://github.com/browser-use/browser-use/blob/main/examples/browser/real_browser.py
