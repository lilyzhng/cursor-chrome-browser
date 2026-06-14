#!/usr/bin/env node
// Smoke test: launch this MCP server over stdio (as Cursor would) and verify it
// exposes all 18 browser tools. Does NOT require the Chrome extension — listing
// tools never touches the browser.
//
// Usage: npm run smoke   (from the server/ directory)

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "mcp-server.js");

const EXPECTED = [
  "tabs_context_mcp", "tabs_create_mcp", "navigate", "computer", "find",
  "form_input", "get_page_text", "gif_creator", "javascript_tool",
  "read_console_messages", "read_network_requests", "read_page",
  "resize_window", "shortcuts_list", "shortcuts_execute", "switch_browser",
  "update_plan", "upload_image",
];

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  // Throwaway port so the smoke test never collides with a live server.
  env: { ...process.env, CURSOR_CHROME_BROWSER_PORT: "19335" },
});

const client = new Client({ name: "smoke-test", version: "0.0.0" }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
const expected = [...EXPECTED].sort();

const missing = expected.filter((n) => !names.includes(n));
const extra = names.filter((n) => !expected.includes(n));

console.log(`Server exposed ${names.length} tools:`);
console.log(names.join(", "));

await client.close();

if (missing.length || extra.length) {
  if (missing.length) console.error(`FAIL: missing tools: ${missing.join(", ")}`);
  if (extra.length) console.error(`FAIL: unexpected tools: ${extra.join(", ")}`);
  process.exit(1);
}
if (names.length !== 18) {
  console.error(`FAIL: expected 18 tools, got ${names.length}`);
  process.exit(1);
}
console.log("PASS: all 18 tools exposed over stdio MCP.");
