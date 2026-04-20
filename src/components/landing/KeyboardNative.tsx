"use client";

import { motion } from "framer-motion";

/**
 * Keyboard-native section — the Raycast / Linear / Antigravity signature.
 *
 * Renders the four shortcuts CommandEgg already listens for, plus a
 * larger visual kbd combo in the center. The copy below makes the
 * positioning claim: "this is a product you run from the keyboard,
 * not a landing page with a contact form."
 *
 * No interactivity beyond CSS hover — the CommandEgg actually handles
 * the listeners globally. This section just advertises what's there.
 */

const SHORTCUTS = [
  { keys: ["/"], desc: "Open command palette from anywhere" },
  { keys: ["⌘", "K"], desc: "Same palette · macOS convention" },
  { keys: ["?"], desc: "Same palette · help-key convention" },
  { keys: ["Esc"], desc: "Dismiss any modal or overlay" },
];

export function KeyboardNative() {
  return (
    <section className="relative px-6 py-28 md:py-36 border-t border-white/[0.04] overflow-hidden">
      {/* Subtle ambient — much lighter than the hero glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[700px] rounded-full opacity-15 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(181,83,44,0.3) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="grid md:grid-cols-[1fr_1fr] gap-12 md:gap-20 items-start">
          {/* LEFT — copy */}
          <div>
            <div className="mb-8 flex items-center gap-4 flex-wrap">
              <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
                08 / 10
              </span>
              <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
              <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C]">
                Keyboard native
              </p>
            </div>

            <h2 className="font-serif text-3xl md:text-5xl leading-[1.08] mb-8 tracking-tight">
              Press{" "}
              <kbd className="inline-block rounded-md border border-[#B5532C]/40 bg-[#B5532C]/10 px-3 py-1 font-serif text-white align-middle shadow-[0_4px_12px_rgba(181,83,44,0.15)]">
                /
              </kbd>
              {" "}anywhere.
              <br />
              <em className="not-italic text-[#B5532C]">
                The whole product opens.
              </em>
            </h2>

            <p className="text-[15px] md:text-[17px] text-neutral-400 leading-[1.65] max-w-md mb-8">
              Built for people who close the tab when they have to click
              a tiny hamburger menu. Every page responds to the same four
              keys — no drop-downs, no mega-menus, no &ldquo;Products ▾&rdquo;
              pretending it&apos;s navigation.
            </p>

            <p className="text-[13px] font-mono text-neutral-500 leading-relaxed max-w-md">
              Four keys. No mouse required. No hamburger menu to find
              first. The same shortcut works wherever you are on this
              page.
            </p>
          </div>

          {/* RIGHT — visual keyboard render */}
          <div className="relative">
            {/* Oversized focal kbd */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-center mb-12"
            >
              <kbd className="group relative inline-flex h-28 w-28 md:h-32 md:w-32 items-center justify-center rounded-2xl bg-gradient-to-b from-[#121010] to-[#0A0807] border border-white/[0.08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.05)]">
                <span className="font-serif text-6xl md:text-7xl text-white tracking-tight select-none">
                  /
                </span>
                {/* Subtle copper underglow */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-6 -bottom-1 h-4 rounded-full opacity-30 blur-xl bg-[#B5532C]"
                />
              </kbd>
            </motion.div>

            {/* Shortcut list */}
            <ul className="space-y-3">
              {SHORTCUTS.map((item, i) => (
                <motion.li
                  key={item.keys.join("-")}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
                  className="flex items-center gap-4 py-2 border-b border-white/[0.04] last:border-b-0"
                >
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.keys.map((k, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <kbd className="inline-block rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-neutral-300 min-w-[24px] text-center">
                          {k}
                        </kbd>
                        {idx < item.keys.length - 1 && (
                          <span className="text-neutral-700 text-[10px]">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="text-[13px] text-neutral-400 tracking-tight">
                    {item.desc}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
