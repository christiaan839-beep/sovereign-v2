/**
 * /badge/embed.js — Embeddable trust badge (Cook 165).
 *
 * Visitors paste three lines on their own site:
 *
 *   <a class="sovereign-badge" href="https://sovereignmatrix.agency"
 *      data-receipt-id="rcpt_xyz"></a>
 *   <script src="https://sovereignmatrix.agency/badge/embed.js"
 *     async></script>
 *
 * The script renders a "Verified by Sovereign" pill in dark mode
 * with cyan accent, links back, and fires a single page-view ping
 * for distribution analytics. Every install is free distribution.
 *
 * No dependencies — vanilla JS, minified-by-hand for speed.
 * Cache-Control set for 1 hour with stale-while-revalidate.
 */

export const dynamic = "force-static";
export const revalidate = 3600;

const SCRIPT = `(function(){
  if (window.__SovereignBadgeLoaded) return;
  window.__SovereignBadgeLoaded = true;
  var ORIGIN = 'https://sovereignmatrix.agency';
  var nodes = document.querySelectorAll('a.sovereign-badge, [data-sovereign-badge]');
  if (!nodes.length) return;
  var css = '.sm-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9999px;background:#010101;border:1px solid rgba(6,182,212,0.25);color:#e5e7eb;font:500 12px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;text-decoration:none;letter-spacing:.02em;transition:border-color .15s}.sm-badge:hover{border-color:rgba(6,182,212,0.6)}.sm-badge svg{width:12px;height:12px;color:#06B6D4;flex-shrink:0}.sm-badge .sm-l{color:#94a3b8;font-weight:400}.sm-badge .sm-v{color:#06B6D4;font-weight:600}';
  var style = document.createElement('style');
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
  nodes.forEach(function(node){
    var rid = node.getAttribute('data-receipt-id') || '';
    var verticalHint = node.getAttribute('data-vertical') || '';
    node.classList.add('sm-badge');
    node.setAttribute('href', ORIGIN + (rid ? '/verify/' + encodeURIComponent(rid) : '/demo/verify-receipt'));
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener');
    node.setAttribute('aria-label', 'Verified by Sovereign Matrix');
    node.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9.6 8 11 4.5-1.4 8-6 8-11V5l-8-3z"/><path d="m9 12 2 2 4-4"/></svg><span class="sm-l">Verified by</span><span class="sm-v">Sovereign</span>';
    try {
      var img = new Image();
      img.src = ORIGIN + '/badge/ping?h=' + encodeURIComponent(location.hostname) + (verticalHint ? '&v=' + encodeURIComponent(verticalHint) : '');
    } catch (e) {}
  });
})();`;

export async function GET(): Promise<Response> {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'",
    },
  });
}
