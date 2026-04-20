"use client";

import { motion } from "framer-motion";

/**
 * BUILT-ON TRUST STRIP — trust-through-association.
 *
 * Studying: stripe.com's "Trusted by" logo strip, vercel.com's
 * provider marks. Elite moves share two traits:
 *   - Logos are MONOCHROME (no brand colors mixed together)
 *   - Hover brightens a single logo without disturbing the row
 *
 * Most SaaS fakes customer logos here. We don't have customers yet,
 * so we show PROVIDER trust — the infrastructure we're built on.
 * More honest than "Fortune 500" we can't back up.
 *
 * Six providers, arranged symmetrically. Wordmarks (not logomarks)
 * because we're referencing well-known names and can't redistribute
 * every logo SVG without license checks.
 */

const BUILT_ON = [
  { name: "Anthropic", tag: "Claude — consensus critic on every run" },
  { name: "NVIDIA NIM", tag: "Nemotron, Llama, DeepSeek via free tier" },
  { name: "Vercel", tag: "Edge + serverless hosting" },
  { name: "Neon", tag: "Postgres + RLS + point-in-time recovery" },
  { name: "Clerk", tag: "Authentication — SOC 2 Type II attested" },
  { name: "Upstash", tag: "Redis rate limits + QStash job queue" },
];

export function BuiltOnStrip() {
  return (
    <section
      aria-label="Infrastructure providers"
      className="px-6 py-12 bg-[#050404]"
    >
      <div className="max-w-6xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[10px] font-mono uppercase tracking-[0.22em] text-neutral-600 mb-8 text-center"
        >
          Built on · Infrastructure with its own trust record
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.08 },
            },
          }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-center gap-x-6 gap-y-8"
        >
          {BUILT_ON.map((provider) => (
            <motion.div
              key={provider.name}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0 },
              }}
              className="group relative flex flex-col items-center"
              title={provider.tag}
            >
              {/* Wordmark — monochrome, brightens on hover */}
              <span
                className="font-serif text-xl lg:text-[22px] tracking-tight text-neutral-500 group-hover:text-white transition-colors duration-300 leading-none"
              >
                {provider.name}
              </span>

              {/* Hidden caption that reveals on hover — rewards attention */}
              <span className="mt-1.5 text-[9.5px] font-mono uppercase tracking-[0.14em] text-neutral-700 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 leading-tight max-w-[140px]">
                {provider.tag}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-10 text-center text-[10px] font-mono text-neutral-700">
          We operate independently. Not formally affiliated with any of the above.
          Each handles a specific layer; we publish which at{" "}
          <a
            href="/trust"
            className="text-neutral-500 underline decoration-[#B5532C]/30 hover:decoration-[#B5532C] hover:text-[#B5532C] transition-colors"
          >
            /trust
          </a>
          .
        </p>
      </div>
    </section>
  );
}
