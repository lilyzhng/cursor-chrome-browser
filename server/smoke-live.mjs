#!/usr/bin/env node
// LIVE end-to-end test: launches a real Chrome with the extension loaded,
// against a throwaway profile, and drives a public page through the REAL
// extension (not a fake). Verifies: extension connects over WebSocket, CDP
// attach works, navigate + get_page_text return live page content.
//
// Throwaway profile (not your real Chrome), so it won't touch your logins.
//
// Usage: npm run smoke:live   (from the server/ directory)
//
// NOTE: recent Chrome ignores/blocks `--load-extension` (anti-malware policy),
// so this harness may report "extension never connected" even though the code is
// correct. In that case, load the extension manually via chrome://extensions ->
// Load unpacked, then drive it from Cursor's Composer. This script is kept as the
// e2e harness for environments where command-line extension loading is allowed.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "mcp-server.js");
const extDir = path.join(here, "..", "extension");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccb-live-"));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function textOf(res) { return res?.content?.map((c) => c.text).filter(Boolean).join("\n") || ""; }

// 1. Start the MCP server (port 9335, which the extension hard-codes).
const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
});
const client = new Client({ name: "live-smoke", version: "0.0.0" }, { capabilities: {} });
await client.connect(transport);

// 2. Launch Chrome with the unpacked extension loaded, throwaway profile.
const chrome = spawn(CHROME, [
  `--load-extension=${extDir}`,
  `--disable-extensions-except=${extDir}`,
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  // Bypass the command-line load-extension kill switch added in recent Chrome.
  "--disable-features=DisableLoadExtensionCommandLineSwitch",
  "about:blank",
], { stdio: "ignore", detached: false });

async function cleanup() {
  try { chrome.kill("SIGTERM"); } catch {}
  try { await client.close(); } catch {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
}

// 3. Poll until the extension connects (tabs_context_mcp stops erroring).
let connected = false;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  const res = await client.callTool({ name: "tabs_context_mcp", arguments: { createIfEmpty: true } });
  const t = textOf(res);
  if (!t.toLowerCase().includes("not connected") && !t.toLowerCase().includes("error")) {
    connected = true;
    console.log(`Extension connected after ~${i + 1}s.`);
    console.log("tabs_context_mcp:", t.split("\n")[0]);
    break;
  }
}

if (!connected) {
  console.error("FAIL: extension never connected. (Chrome may have blocked --load-extension.)");
  await cleanup();
  process.exit(1);
}

// 4. Find the tab id, navigate to example.com, read the page text.
const ctx = await client.callTool({ name: "tabs_context_mcp", arguments: { createIfEmpty: true } });
let tabId;
try {
  const json = JSON.parse(textOf(ctx).split("\n")[0]);
  tabId = json.availableTabs?.[0]?.tabId;
} catch {}
if (tabId == null) { console.error("FAIL: could not determine tabId."); await cleanup(); process.exit(1); }

await client.callTool({ name: "navigate", arguments: { url: "https://example.com", tabId } });
await sleep(1500);
const pageText = textOf(await client.callTool({ name: "get_page_text", arguments: { tabId } }));
console.log("get_page_text (first 200 chars):", pageText.slice(0, 200).replace(/\s+/g, " "));

await cleanup();

if (pageText.includes("Example Domain")) {
  console.log("PASS: real extension drove Chrome via CDP and read live page content.");
} else {
  console.error("FAIL: did not read expected content from example.com.");
  process.exit(1);
}
