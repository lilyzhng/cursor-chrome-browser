#!/usr/bin/env node
// Transport smoke test: exercises the full request path that we rewrote
//   MCP client -> server (stdio) -> sendToExtension -> WebSocket -> extension
//   -> WebSocket -> server -> MCP client
// using a FAKE extension (a plain WebSocket client) that echoes a canned result.
// This verifies the WebSocket transport without needing Chrome.
//
// Usage: npm run smoke:transport   (from the server/ directory)

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "mcp-server.js");
const PORT = "19337";
const MARKER = "FAKE_EXTENSION_OK";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 1. Launch the server over stdio MCP (this also starts its WebSocket server).
const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  env: { ...process.env, CURSOR_CHROME_BROWSER_PORT: PORT },
});
const client = new Client({ name: "transport-smoke", version: "0.0.0" }, { capabilities: {} });
await client.connect(transport);

// 2. Connect a fake extension over WebSocket and echo a canned tool_response.
const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
await new Promise((resolve, reject) => {
  ws.on("open", resolve);
  ws.on("error", reject);
});
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "tool_request" && msg.id) {
    ws.send(JSON.stringify({
      id: msg.id,
      type: "tool_response",
      result: { content: [{ type: "text", text: `${MARKER}: ${msg.tool}` }] },
    }));
  }
});

// Give the server a moment to register the connection.
await sleep(200);

// 3. Call a tool through MCP; it must round-trip through the fake extension.
const res = await client.callTool({ name: "tabs_create_mcp", arguments: {} });
const text = res?.content?.map((c) => c.text).join("\n") || "";
console.log("Tool result routed back:", text);

ws.close();
await client.close();

if (text.includes(MARKER)) {
  console.log("PASS: tool call round-tripped MCP -> server -> WebSocket -> extension -> back.");
} else {
  console.error("FAIL: did not receive the fake extension's response.");
  process.exit(1);
}
