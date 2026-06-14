# Cursor Chrome Browser — design

## Goal

One cohesive product that lets **Cursor's Composer 2.5** drive your **real, logged-in Chrome** —
install once, works in Composer. Not a pile of third-party parts glued together.

## Architecture (2 components)

```
Cursor (Composer 2.5)
   ⇅  stdio MCP
server/mcp-server.js   ── our MCP server: exposes 18 browser tools to Cursor,
   ⇅  WebSocket            and runs a localhost WebSocket server
       (127.0.0.1:9335)
extension/ (background.js)  ── our Chrome extension: WebSocket client that drives
   ⇅  chrome.debugger / CDP    tabs via the Chrome DevTools Protocol
Your real Chrome tabs (your existing logins)
```

Two parts, one product:

1. **Chrome extension** (`extension/`) — Manifest V3. Drives tabs through `chrome.debugger`
   (CDP): click, type, screenshot, scroll, read accessibility tree, run JS, read console/network.
   It is a **WebSocket client** that connects to the MCP server.
2. **MCP server** (`server/mcp-server.js`) — a stdio MCP server Cursor launches via `~/.cursor/mcp.json`.
   It exposes the 18 tools to Composer and runs a **localhost WebSocket server** the extension
   connects to. When Composer calls a tool, the server forwards it over the WebSocket to the
   extension, which executes it via CDP and returns the result.

## Why this shape (and what we rejected)

We studied `noemica-io/open-claude-in-chrome` (a clean-room clone of Claude-in-Chrome's 18 tools).
Its CDP tool implementations are excellent and we **borrow them**. Its **transport** is not what we
want:

```
reference:  Cursor ⇄[stdio]⇄ mcp-server ⇄[TCP]⇄ native-host ⇄[native messaging]⇄ extension ⇄ Chrome
ours:       Cursor ⇄[stdio]⇄ mcp-server ⇄[WebSocket]⇄ extension ⇄ Chrome
```

- **Dropped the native-messaging host.** A Chrome extension can't open a raw socket, so the
  reference used Chrome **native messaging**, which requires a separate host process Chrome
  launches — and `install.sh` registering a native-messaging manifest keyed to the extension ID,
  plus copying that ID and restarting the browser. That is the install friction we're eliminating.
- **An extension *can* open a WebSocket to localhost.** So our extension connects directly to the
  MCP server over WebSocket. Three hops → two. No native host, no `install.sh`, no ID juggling.
- **Dropped the fixed-TCP multi-session primary/client logic** for v1 (simplicity). One Cursor
  session ↔ one browser. Multi-session is a later concern.
- **Retargeted Claude Code → Cursor** and rebranded to **Cursor Chrome Browser**.

## What we borrow vs. rewrite

| From the reference | Action |
|---|---|
| `extension/background.js` tool handlers (CDP: click/type/screenshot/scroll/read/JS/console/network) | **Borrow** (copied), transport swapped to WebSocket |
| `extension/content.js` (accessibility tree, find, form input, page text) | **Borrow** (verbatim) |
| `host/mcp-server.js` 18 tool schemas + MCP wiring | **Borrow**, transport swapped to WebSocket server |
| `host/native-host.js`, `install.sh`, native messaging, TCP primary/client | **Drop / rewrite** |

## Message protocol (over WebSocket)

- server → extension: `{ id, type: "tool_request", tool, args }`
- extension → server: `{ id, type: "tool_response", result }` or `{ id, type: "tool_error", error }`

## Install (target UX)

1. Install the **Cursor Chrome Browser** extension (Chrome Web Store; dev: Load unpacked).
2. Add one block to `~/.cursor/mcp.json` pointing at `server/mcp-server.js`.
3. In Composer, give a command; on first use, pick the tab to hand over. Done.

## Risks / phase-2

- **No auth on the localhost WebSocket (v1).** Any local process could connect to `127.0.0.1:9335`.
  Acceptable for a local dev tool (parity with the reference, which used unauthenticated localhost
  TCP); phase-2 add a token handshake.
- **Single session (v1).** Port is fixed; a second concurrent Cursor server would conflict.
  Phase-2: restore a primary/client sharing model over WebSocket.
- **Icons / branding** are placeholders borrowed from the reference; rebrand before any public release.
- **Agent acts as logged-in you** once a tab is connected — scope which tab you hand over.
