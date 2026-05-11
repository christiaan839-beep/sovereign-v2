/**
 * GET /embed/verify.js — embeddable "Sovereign Verified" badge.
 *
 * Customers drop one line on their site:
 *
 *   <script src="https://sovereignmatrix.agency/embed/verify.js"
 *           data-receipt="<receipt-id>"
 *           data-theme="dark"      <!-- "dark" | "light", default "dark" -->
 *           data-link="hide"       <!-- "show" | "hide", default "show" -->
 *           async></script>
 *
 * The script:
 *   1. Reads its own data-* attributes (or `data-receipt-id` legacy).
 *   2. Fetches /api/agent-runs/<id> (open CORS for public/unlisted runs).
 *   3. POSTs the canonical+signature to /api/verify.
 *   4. Renders an inline badge at the script's injection point with the
 *      verification status, agent name, and timestamp.
 *
 * On verification failure or any HTTP error, the badge renders in a
 * "verification failed" state — never a blank or broken DOM.
 *
 * No iframe. No third-party JS. Single self-contained DOM injection.
 * ~2KB minified. CSP-safe (no eval, no innerHTML for user data).
 *
 * This is the "SSL-Labs-style" trust signal that no agent platform
 * ships today. Customers slap it on their AI-powered features and
 * end users see "Verified by Sovereign" — clickable through to the
 * full receipt.
 */

import { NextResponse } from "next/server";

const SCRIPT = `(function () {
  "use strict";

  function $(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "style") el.style.cssText = attrs[k];
        else if (k === "text") el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        if (children[i]) el.appendChild(children[i]);
      }
    }
    return el;
  }

  // Find the *current* script tag — works during sync execution before
  // the DOM is fully parsed because document.currentScript is set on
  // the executing element.
  var current = document.currentScript;
  if (!current) return;

  var origin = (function () {
    try {
      var u = new URL(current.src);
      return u.origin;
    } catch (_) {
      return "";
    }
  })();

  var receiptId =
    current.getAttribute("data-receipt") ||
    current.getAttribute("data-receipt-id");
  if (!receiptId) {
    console.warn("[sovereign-verify] missing data-receipt attribute");
    return;
  }

  var theme = current.getAttribute("data-theme") === "light" ? "light" : "dark";
  var showLink = current.getAttribute("data-link") !== "hide";

  // ── Theme ──
  var styles = {
    dark: {
      bg: "#030303",
      border: "rgba(34,211,238,0.30)",
      text: "#e5e5e5",
      sub: "#a3a3a3",
      ok: "#34d399",
      bad: "#f87171",
      neutral: "rgba(34,211,238,0.85)",
    },
    light: {
      bg: "#ffffff",
      border: "rgba(8,145,178,0.30)",
      text: "#0a0a0a",
      sub: "#525252",
      ok: "#059669",
      bad: "#dc2626",
      neutral: "rgba(8,145,178,0.85)",
    },
  };
  var s = styles[theme];

  // ── Mount target ──
  var mount = $("span", {
    "data-sovereign-verify": receiptId,
    style:
      "display:inline-flex;align-items:center;gap:8px;padding:6px 12px;" +
      "border-radius:9999px;border:1px solid " + s.border + ";" +
      "background:" + s.bg + ";color:" + s.text + ";" +
      "font:500 12px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;" +
      "vertical-align:middle;text-decoration:none;",
  });

  // Insert just before the script tag so the badge appears in flow.
  if (current.parentNode) {
    current.parentNode.insertBefore(mount, current);
  }

  // ── Loading state ──
  function setState(opts) {
    while (mount.firstChild) mount.removeChild(mount.firstChild);

    var dotColor =
      opts.state === "ok"
        ? s.ok
        : opts.state === "bad"
        ? s.bad
        : s.neutral;
    var dot = $("span", {
      style:
        "display:inline-block;width:6px;height:6px;border-radius:9999px;" +
        "background:" + dotColor + ";box-shadow:0 0 6px " + dotColor + ";",
    });

    var label = $("span", {
      text: opts.label || "Sovereign",
      style: "font-weight:600;letter-spacing:0.02em;",
    });

    var sub = opts.sub
      ? $("span", {
          text: opts.sub,
          style: "color:" + s.sub + ";font-weight:400;",
        })
      : null;

    if (showLink && opts.state !== "loading") {
      var link = $("a", {
        href: origin + "/r/" + receiptId,
        target: "_blank",
        rel: "noopener noreferrer",
        style:
          "color:" + s.text + ";text-decoration:none;display:inline-flex;" +
          "align-items:center;gap:8px;",
        "aria-label": "Open verifiable receipt",
      });
      link.appendChild(dot);
      link.appendChild(label);
      if (sub) link.appendChild(sub);
      mount.appendChild(link);
    } else {
      mount.appendChild(dot);
      mount.appendChild(label);
      if (sub) mount.appendChild(sub);
    }
  }

  setState({ state: "loading", label: "Verifying…" });

  // ── Fetch + verify ──
  fetch(origin + "/api/agent-runs/" + encodeURIComponent(receiptId), {
    headers: { Accept: "application/json" },
    credentials: "omit",
  })
    .then(function (res) {
      if (!res.ok) throw new Error("receipt-fetch-" + res.status);
      return res.json();
    })
    .then(function (receipt) {
      return fetch(origin + "/api/verify", {
        method: "POST",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          canonical: receipt.canonical,
          signature: receipt.signature,
        }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error("verify-" + r.status);
          return r.json();
        })
        .then(function (verdict) {
          if (verdict.valid) {
            setState({
              state: "ok",
              label: "Verified by Sovereign",
              sub: "· " + (receipt.agentName || "agent"),
            });
          } else {
            setState({
              state: "bad",
              label: "Signature mismatch",
              sub: "· " + receiptId.slice(0, 6),
            });
          }
        });
    })
    .catch(function (err) {
      setState({
        state: "bad",
        label: "Unverified",
        sub: String(err && err.message ? err.message : err).slice(0, 32),
      });
    });
})();`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      // The script is meant to run cross-origin from any customer site
      "Access-Control-Allow-Origin": "*",
      // Defense-in-depth: this is JS, not HTML — never let a browser
      // mis-sniff it as HTML where it could become a stored-XSS vector.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
