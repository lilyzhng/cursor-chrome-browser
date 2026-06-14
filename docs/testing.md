# Testing log — Cursor Chrome Browser

Record of the test scenarios run while building the product, what each one verifies, how to
reproduce it, and the result. Layered from "no browser needed" up to "real Chrome, real Composer."

## Summary

| # | Scenario | Needs Chrome? | Needs Composer? | Result |
|---|---|---|---|---|
| 1 | Server tool-listing (`npm run smoke`) | No | No | ✅ PASS |
| 2 | Transport round-trip (`npm run smoke:transport`) | No (fake extension) | No | ✅ PASS |
| 3 | CLI live harness (`npm run smoke:live`) | Yes (CLI launch) | No | ⚠️ Blocked by Chrome policy (not a code bug) |
| 4 | Real extension ↔ server handshake | Yes (manual load) | No | ✅ PASS (observed live) |
| 5 | Full end-to-end in Composer 2.5 (read) | Yes | Yes | ✅ PASS (out of the box) |
| 6 | Write action on a logged-in site (Twitter reply) | Yes | Yes | ✅ PASS (stopped before Post) |
| 7 | LinkedIn (read feed / draft comment) | Yes | Yes | ✅ PASS |
| 8 | DoorDash food order | Yes | Yes | ✅ PASS (order placed) |
| 9 | Spotify — play Dua Lipa (video, fullscreen) | Yes | Yes | ✅ PASS |

---

## 1. Server tool-listing — `npm run smoke`

**Verifies:** the MCP server starts over stdio (the way Cursor launches it) and exposes all 18
browser tools. Pure server check — no browser, no WebSocket peer.

**How:** `cd server && npm run smoke` (uses a throwaway port `19335`).

**Result:** ✅ PASS — 18 tools listed: `tabs_context_mcp, tabs_create_mcp, navigate, computer,
find, form_input, get_page_text, gif_creator, javascript_tool, read_console_messages,
read_network_requests, read_page, resize_window, shortcuts_list, shortcuts_execute,
switch_browser, update_plan, upload_image`.

## 2. Transport round-trip — `npm run smoke:transport`

**Verifies:** the transport we rewrote (native messaging + TCP → a single WebSocket). A **fake
extension** (a plain WebSocket client) connects and echoes a canned result, proving a tool call
routes the whole path: `MCP client → server (stdio) → sendToExtension → WebSocket → extension →
WebSocket → server → MCP client`.

**How:** `cd server && npm run smoke:transport` (throwaway port `19337`).

**Result:** ✅ PASS — `tabs_create_mcp` call round-tripped and returned the fake extension's
response (`FAKE_EXTENSION_OK: tabs_create_mcp`).

## 3. CLI live harness — `npm run smoke:live`

**Verifies (intended):** launch a real Chrome with the unpacked extension on a throwaway profile,
then drive `example.com` through the **real** extension (connect → CDP attach → navigate →
get_page_text).

**How:** `cd server && npm run smoke:live`.

**Result:** ⚠️ Blocked — **not a code bug**. Recent Chrome ignores/blocks `--load-extension`
(anti-malware policy), so the extension never loads via the command line and the harness reports
"extension never connected." The harness is kept for environments where command-line extension
loading is permitted; in practice, load the extension manually (scenario 4) instead.

## 4. Real extension ↔ server handshake (manual load) — 2026-06-14

**Verifies:** the **actual** extension, loaded in real Chrome, connects to the server over the
WebSocket.

**Steps performed:**
1. `chrome://extensions` → Developer mode → **Load unpacked** → selected `extension/`. Extension
   loaded; its `background.js` service worker started.
2. With no server running, the extension logged
   `WebSocket connection to 'ws://127.0.0.1:9335/' failed: net::ERR_CONNECTION_REFUSED` and kept
   retrying — i.e. the reconnect loop works as designed (the error simply means "server not up
   yet").
3. Started the server; server log printed **`Cursor Chrome Browser extension connected.`** within
   ~seconds.

**Result:** ✅ PASS — real extension ↔ real server WebSocket handshake confirmed live.

## 5. Full end-to-end in Composer 2.5 — 2026-06-14

**Verifies:** the whole product from Cursor's UI: Composer 2.5 driving the real extension to
operate a real page.

**Steps performed:**
1. Cursor Settings → MCP shows `cursor-chrome-browser` **green, 18 tools enabled**; Cursor spawned
   the server on port 9335 (confirmed via `lsof`).
2. In Composer (model = Composer 2.5), one prompt asked it to get tab context, navigate, and read
   a page. Composer autonomously ran `tabs_context_mcp(createIfEmpty: true)` → `navigate` →
   `get_page_text`, created the blue **MCP** tab group, opened the Decagon blog post
   ("Why off-policy training isn't enough…"), and returned the title + first sentence verbatim.

**Result:** ✅ PASS — worked out of the box, fast, on first real run.

## 6. Write action on a logged-in site — Twitter reply — 2026-06-14

**Verifies:** read **and write** on a real logged-in third-party site — the strongest proof that
Composer 2.5 matches Claude-in-Chrome. Composer opens your logged-in Twitter/X, reads a target
user's latest post, and types a reply.

**Human-in-the-loop:** posting is a public action as you. By design, Composer **types the comment
but stops before clicking "Post"** so you confirm before anything goes public.

**Prompt (model = Composer 2.5):**
> Using the cursor-chrome-browser tools:
> 1. tabs_context_mcp (createIfEmpty: true) to open a new tab
> 2. navigate to https://x.com/srush_nlp
> 3. read_page / get_page_text to find their latest original post, and read me the full text
> 4. type a comment into the reply box under that post: "<comment text>"
> 5. Do NOT click Post — take a screenshot and show me to confirm; I'll tell you when to send

**Steps performed:** Composer opened the logged-in `@srush_nlp` profile, read his latest post (on
on-policy self-distillation, listing OPD / Self-Distillation / RL-via-Self-Distillation arxiv
links), found the reply box under it, and typed **"Thank you, Professor."** It stopped there with
the reply composed and the **Reply** button un-clicked, awaiting confirmation.

**Result:** ✅ PASS — read + write on a real logged-in site, using the existing session (no
re-login), with the human-in-the-loop gate respected (typed but did not post). This is the
headline proof: Composer 2.5 doing exactly what Claude-in-Chrome does.

## 7. LinkedIn — read feed / draft a comment — 2026-06-14

**Verifies:** browser-use on a site with no usable API. LinkedIn blocks its API and kills scrapers,
so reading the feed or drafting a comment basically *requires* the logged-in browser. On-brand for a
career audience.

**Human-in-the-loop:** any comment/connection note is public — draft but stop before posting.

**Prompt (model = Composer 2.5):**
> Using the cursor-chrome-browser tools: open a new tab, navigate to https://www.linkedin.com/feed/,
> read the latest post from <person>, and draft a thoughtful comment in the reply box. Do NOT post —
> screenshot and let me confirm.

**Result:** ✅ PASS — drove the logged-in LinkedIn feed and drafted a comment, stopping before
posting. Confirmed working (Lily, 2026-06-14).

## 8. DoorDash — food order — 2026-06-14

**Verifies:** highest-wow browser-use — no public ordering API, payoff lands in the physical world.

**Human-in-the-loop:** spends real money and is irreversible — stop before the final "Place Order"
(or accept a real order for the wow factor, deliberately).

**Prompt (model = Composer 2.5):**
> Using the cursor-chrome-browser tools: open a new tab, navigate to https://www.doordash.com,
> find molly tea / Premium Jasmine Milk Tea, add it to the cart, and go to checkout. 
> place the order, screenshot the order summary 

**Result:** ✅ PASS — Composer found the item on the logged-in DoorDash account, added it to cart,
checked out, and **placed a real order** (the human-in-the-loop stop was deliberately waived for the
wow factor). Confirmed working (Lily, 2026-06-14).

## 9. Spotify — play Dua Lipa — 2026-06-14

**Verifies:** fast, click-and-play demo with an immediate (audible) effect. Note: weakest on the
"necessity" axis (Spotify has an API and a native app — see `docs/demos.md`), chosen for speed of
payoff.

**Caveats:** needs an active logged-in Spotify session; on-demand play in the web player generally
requires Premium (free accounts may only shuffle).

**Prompt (model = Composer 2.5):**
> Using the cursor-chrome-browser tools: open a new tab, navigate to
> https://open.spotify.com/, take a screenshot, find Dua Lipa's song, training season
> click Play. click the button switch to video, click enter full screen
> Screenshot the page to confirm music video is playing.

**Result:** ✅ PASS — opened Spotify, played Dua Lipa's "Training Season," switched to the video and
entered full screen. Immediate audible/visible payoff. Confirmed working (Lily, 2026-06-14).

---

## Not yet tested / next

- **Multi-session** (two Cursor clients at once) — v1 is single-session; the WebSocket port is fixed.
- **WebSocket auth** — v1 binds to localhost with no token; see `docs/design.md` Risks/phase-2.
