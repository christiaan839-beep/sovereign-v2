/**
 * Sovereign Matrix — VS Code extension entry (Cook 80).
 *
 * Mirrors the Cook 65 extension-sdk shape in vanilla JS so the
 * extension stays dependency-free (no bundler, no transpile step
 * required to ship). The platform SDK in src/lib/extension-sdk.ts
 * remains the source of truth for the protocol — both surfaces
 * speak the same wire shape.
 */

const vscode = require("vscode");

const MAX_SELECTION_BYTES = 50_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const SLUG_RE = /^[a-z][a-z0-9-]{1,63}$/;

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("sovereign.runOnSelection", () =>
      runOnSelection(context),
    ),
    vscode.commands.registerCommand("sovereign.setPat", () => setPat(context)),
    vscode.commands.registerCommand("sovereign.setAgent", () =>
      setAgent(context),
    ),
  );
}

function deactivate() {}

async function setPat(context) {
  const pat = await vscode.window.showInputBox({
    prompt: "Sovereign Matrix Personal Access Token",
    password: true,
    ignoreFocusOut: true,
  });
  if (!pat) return;
  await context.secrets.store("sovereign.pat", pat.trim());
  vscode.window.showInformationMessage("Sovereign PAT saved.");
}

async function setAgent(context) {
  const cfg = vscode.workspace.getConfiguration("sovereign");
  const current = cfg.get("defaultAgent") || "smart-router";
  const slug = await vscode.window.showInputBox({
    prompt: "Default agent slug",
    value: current,
    validateInput: (v) =>
      SLUG_RE.test(v.trim())
        ? null
        : "Slug must match /^[a-z][a-z0-9-]{1,63}$/",
  });
  if (!slug) return;
  await cfg.update(
    "defaultAgent",
    slug.trim(),
    vscode.ConfigurationTarget.Global,
  );
  vscode.window.showInformationMessage(`Default agent: ${slug}`);
}

async function runOnSelection(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open an editor first.");
    return;
  }
  const selection = editor.document.getText(editor.selection).trim();
  if (!selection) {
    vscode.window.showWarningMessage("Select some text first.");
    return;
  }
  const byteLen = Buffer.byteLength(selection, "utf8");
  if (byteLen > MAX_SELECTION_BYTES) {
    vscode.window.showErrorMessage(
      `Selection exceeds ${MAX_SELECTION_BYTES} bytes — shorten or run from the dashboard.`,
    );
    return;
  }

  const pat = await context.secrets.get("sovereign.pat");
  if (!pat) {
    const action = await vscode.window.showWarningMessage(
      "No PAT configured. Set one now?",
      "Set PAT",
    );
    if (action === "Set PAT") await setPat(context);
    return;
  }
  const cfg = vscode.workspace.getConfiguration("sovereign");
  const apiBase = (cfg.get("apiBase") || "https://sovereignmatrix.agency")
    .toString()
    .replace(/\/$/, "");
  const agentSlug = (cfg.get("defaultAgent") || "smart-router").toString();

  const file = editor.document.fileName;
  const lang = editor.document.languageId;
  const body = {
    kind: "editor-text",
    text: selection,
    languageId: lang,
    filePath: file,
    lineRange: {
      start: editor.selection.start.line + 1,
      end: editor.selection.end.line + 1,
    },
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Sovereign — running agent",
      cancellable: false,
    },
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(`${apiBase}/api/agents/${agentSlug}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pat}`,
            "Content-Type": "application/json",
            "X-Sovereign-Client": "vscode-ext",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.status === 429) {
          vscode.window.showWarningMessage("Rate-limited. Try again shortly.");
          return;
        }
        if (!res.ok) {
          vscode.window.showErrorMessage(`Sovereign returned ${res.status}.`);
          return;
        }
        const data = await res.json();
        const panel = vscode.window.createOutputChannel("Sovereign Matrix");
        panel.clear();
        panel.appendLine(data.headline ?? "Sovereign result");
        panel.appendLine("");
        panel.appendLine(String(data.body ?? ""));
        if (Array.isArray(data.citations) && data.citations.length) {
          panel.appendLine("");
          panel.appendLine("Citations:");
          for (const c of data.citations) {
            panel.appendLine(
              `  [${c.id}] ${c.label}${c.url ? " — " + c.url : ""}`,
            );
          }
        }
        if (data.receiptId) {
          panel.appendLine("");
          panel.appendLine(`Receipt: ${data.receiptId}`);
        }
        panel.show(true);
      } catch (err) {
        const aborted = err && err.name === "AbortError";
        vscode.window.showErrorMessage(
          aborted
            ? "Sovereign request timed out."
            : `Sovereign error: ${err?.message ?? String(err)}`,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  );
}

module.exports = { activate, deactivate };
