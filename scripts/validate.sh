#!/usr/bin/env bash
# Headless validation that Composer 2.5 + Playwright MCP can drive a browser end-to-end.
#
# This deliberately does NOT use --extension mode. Extension mode reuses your real,
# logged-in Chrome and needs a one-click GUI tab-connect that a headless CLI cannot do.
# To isolate "does the model + browser tooling work" from that one manual step, we spin up
# a throwaway, headless, isolated browser profile and read the public example.com.
#
# Requirements: cursor-agent CLI (authenticated), npx.
set -euo pipefail

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

mkdir -p "$WORKDIR/.cursor"
cat > "$WORKDIR/.cursor/mcp.json" <<'JSON'
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless", "--isolated", "--browser", "chrome"]
    }
  }
}
JSON

echo "==> Enabling playwright MCP for cursor-agent in throwaway workspace"
( cd "$WORKDIR" && cursor-agent mcp enable playwright >/dev/null 2>&1 || true )

echo "==> Driving example.com with composer-2.5 (headless)"
OUTPUT="$(cd "$WORKDIR" && cursor-agent --print --force --approve-mcps --trust \
  --model composer-2.5 --output-format text \
  "Use the playwright browser MCP tools (browser_navigate, browser_snapshot) to open https://example.com . Then report the exact text of the page's main <h1> heading and the first sentence of the paragraph. Only report what you actually read via the tools." 2>&1)"

echo "----- composer-2.5 output -----"
echo "$OUTPUT"
echo "-------------------------------"

if echo "$OUTPUT" | grep -qi "Example Domain"; then
  echo "PASS: composer-2.5 drove the headless browser and read live page content."
else
  echo "FAIL: did not find expected page content in output." >&2
  exit 1
fi
