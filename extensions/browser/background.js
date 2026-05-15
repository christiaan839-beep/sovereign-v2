/**
 * Sovereign Matrix — Browser extension background (Cook 80).
 *
 * Right-click → "Run Sovereign agent on selection". Forwards the
 * selection to /api/agents/<slug> via the shared invokeAgent SDK
 * surface. PAT is stored in chrome.storage.local, set via the
 * options page.
 *
 * No bundler — this loads as a plain MV3 service worker. The
 * extension-sdk.ts shape is re-implemented here in vanilla JS so
 * the extension stays dependency-free.
 */

const API_BASE = "https://sovereignmatrix.agency";
const DEFAULT_AGENT = "smart-router";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sovereign.run",
    title: "Run Sovereign agent on selection",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "sovereign.run") return;
  const selectionText = String(info.selectionText ?? "").trim();
  if (!selectionText) {
    notify("Sovereign", "No text selected.");
    return;
  }

  const { pat, agentSlug } = await chrome.storage.local.get([
    "pat",
    "agentSlug",
  ]);
  if (!pat) {
    notify("Sovereign", "Set your PAT in the options page first.");
    chrome.runtime.openOptionsPage();
    return;
  }

  const pageUrl = tab?.url ?? "";
  try {
    const res = await fetch(
      `${API_BASE}/api/agents/${agentSlug || DEFAULT_AGENT}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pat}`,
          "Content-Type": "application/json",
          "X-Sovereign-Client": "browser-ext",
        },
        body: JSON.stringify({
          kind: "browser-text",
          text: selectionText,
          pageUrl,
          pageTitle: tab?.title ?? "",
        }),
      },
    );
    if (res.status === 429) {
      notify("Sovereign", "Rate-limited. Try again in a moment.");
      return;
    }
    if (!res.ok) {
      notify("Sovereign", `Upstream error ${res.status}.`);
      return;
    }
    const data = await res.json();
    notify(
      data.headline ?? "Sovereign result",
      (data.body ?? "").slice(0, 280),
    );
  } catch (err) {
    notify("Sovereign", `Network error: ${err?.message ?? String(err)}`);
  }
});

function notify(title, message) {
  chrome.notifications?.create({
    type: "basic",
    title,
    message,
    iconUrl: "icon-128.png",
  });
}
