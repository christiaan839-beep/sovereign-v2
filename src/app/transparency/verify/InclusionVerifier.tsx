"use client";

import { useState } from "react";
import {
  Hash,
  ShieldCheck,
  AlertTriangle,
  Terminal,
  Loader2,
} from "lucide-react";

/**
 * Browser-local inclusion-proof verifier.
 *
 * Fetches the proof from the public /api/transparency/proof endpoint,
 * then computes every SHA-256 hash in the fold locally via Web Crypto.
 * Nothing in this widget trusts the server for the verification step —
 * the server is only the source of (proof, leafHash, treeSize, sthRoot).
 *
 * Shows the step-by-step fold so the visitor can trace each inner hash.
 */

const INNER_PREFIX = new Uint8Array([0x01]);

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, "0");
  }
  return s;
}

async function sha256(...parts: Uint8Array[]): Promise<string> {
  const totalLen = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const buf = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    buf.set(p, offset);
    offset += p.byteLength;
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return bytesToHex(new Uint8Array(digest));
}

async function innerHash(leftHex: string, rightHex: string): Promise<string> {
  return sha256(INNER_PREFIX, hexToBytes(leftHex), hexToBytes(rightHex));
}

function bitsLen(n: number): number {
  let x = n;
  let len = 0;
  while (x > 0) {
    x = Math.floor(x / 2);
    len++;
  }
  return len;
}

function onesCount(n: number): number {
  let x = n;
  let c = 0;
  while (x > 0) {
    c += x & 1;
    x = Math.floor(x / 2);
  }
  return c;
}

interface FoldStep {
  step: number;
  left: string;
  right: string;
  out: string;
}

interface VerifyResult {
  ok: boolean;
  finalRoot: string;
  expectedRoot: string;
  fold: FoldStep[];
}

async function verifyInclusion(
  leafHash: string,
  idx: number,
  treeSize: number,
  proof: string[],
  rootHash: string,
): Promise<VerifyResult> {
  const fold: FoldStep[] = [];
  if (treeSize === 1) {
    return {
      ok: leafHash === rootHash && proof.length === 0,
      finalRoot: leafHash,
      expectedRoot: rootHash,
      fold,
    };
  }
  const inner = bitsLen(idx ^ (treeSize - 1));
  const border = onesCount(Math.floor(idx / Math.pow(2, inner)));
  if (proof.length !== inner + border) {
    return {
      ok: false,
      finalRoot: "(proof length mismatch)",
      expectedRoot: rootHash,
      fold,
    };
  }
  let hash = leafHash;
  let step = 1;
  for (let i = 0; i < inner; i++) {
    const sib = proof[i];
    if (Math.floor(idx / Math.pow(2, i)) % 2 === 0) {
      const out = await innerHash(hash, sib);
      fold.push({ step: step++, left: hash, right: sib, out });
      hash = out;
    } else {
      const out = await innerHash(sib, hash);
      fold.push({ step: step++, left: sib, right: hash, out });
      hash = out;
    }
  }
  for (let i = 0; i < border; i++) {
    const sib = proof[inner + i];
    const out = await innerHash(sib, hash);
    fold.push({ step: step++, left: sib, right: hash, out });
    hash = out;
  }
  return {
    ok: hash === rootHash,
    finalRoot: hash,
    expectedRoot: rootHash,
    fold,
  };
}

interface ProofResponse {
  index: number;
  treeSize: number;
  leafHash: string;
  proof: string[];
}

interface SthResponse {
  treeSize: number;
  rootHash: string;
}

export function InclusionVerifier() {
  const [index, setIndex] = useState("0");
  const [size, setSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [proofData, setProofData] = useState<ProofResponse | null>(null);
  const [sth, setSth] = useState<SthResponse | null>(null);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setProofData(null);
    setSth(null);
    setLoading(true);
    try {
      // Fetch current STH so we know the root for the user-supplied treeSize.
      // If treeSize is empty, default to current STH size.
      const sthRes = await fetch("/api/transparency/sth");
      if (!sthRes.ok)
        throw new Error(`STH fetch failed: HTTP ${sthRes.status}`);
      const sthBody = (await sthRes.json()) as {
        treeSize: number;
        rootHash: string;
      };
      const effectiveSize = size.trim() ? Number(size) : sthBody.treeSize;
      const effectiveIdx = Number(index);

      if (!Number.isFinite(effectiveIdx) || effectiveIdx < 0) {
        throw new Error("Index must be a non-negative integer");
      }
      if (!Number.isFinite(effectiveSize) || effectiveSize <= 0) {
        throw new Error("Tree size must be a positive integer");
      }
      if (effectiveSize > sthBody.treeSize) {
        throw new Error(
          `Tree size ${effectiveSize} exceeds current log size ${sthBody.treeSize}`,
        );
      }
      if (effectiveIdx >= effectiveSize) {
        throw new Error(
          `Index ${effectiveIdx} must be < tree size ${effectiveSize}`,
        );
      }

      // Fetch inclusion proof
      const proofRes = await fetch(
        `/api/transparency/proof?kind=inclusion&index=${effectiveIdx}&size=${effectiveSize}`,
      );
      if (!proofRes.ok)
        throw new Error(`Proof fetch failed: HTTP ${proofRes.status}`);
      const proofBody = (await proofRes.json()) as ProofResponse;

      // If the user-supplied size matches the current STH size, the expected
      // root is sthBody.rootHash. Otherwise we'd need to fetch a historical
      // STH (not exposed by the current API). For the demo, only the current
      // STH's root is auditable in-browser.
      const expectedRoot =
        effectiveSize === sthBody.treeSize
          ? sthBody.rootHash
          : "(historical STH not exposed)";

      setProofData(proofBody);
      setSth({ treeSize: sthBody.treeSize, rootHash: sthBody.rootHash });

      if (expectedRoot.startsWith("(")) {
        // Can't verify against historical STH from the current endpoint
        setError(
          "Verification against historical STH sizes requires a witnessed-STH lookup, which the current demo endpoint doesn't expose. Use size=current for browser-local verification.",
        );
        setLoading(false);
        return;
      }

      const verdict = await verifyInclusion(
        proofBody.leafHash,
        proofBody.index,
        proofBody.treeSize,
        proofBody.proof,
        expectedRoot,
      );
      setResult(verdict);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onVerify} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-1 block">
            Leaf index
          </span>
          <input
            type="number"
            min="0"
            value={index}
            onChange={(e) => setIndex(e.target.value)}
            className="w-full px-3 py-2 bg-black/40 border border-white/[0.10] rounded-[3px] font-mono text-[13px] text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40"
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-1 block">
            Tree size (blank = current)
          </span>
          <input
            type="number"
            min="1"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full px-3 py-2 bg-black/40 border border-white/[0.10] rounded-[3px] font-mono text-[13px] text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40"
            placeholder="(current)"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white text-[13px] font-mono tracking-[0.1em] rounded-[3px] hover:bg-[#C96234] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Fetching + verifying…
          </>
        ) : (
          <>
            <Terminal className="w-4 h-4" />
            Verify in browser
          </>
        )}
      </button>

      {error && (
        <div className="p-4 border border-rose-500/30 bg-rose-500/[0.04] rounded-[3px]">
          <p className="flex items-center gap-2 font-mono text-[10px] text-rose-300 tracking-[0.2em] uppercase mb-2">
            <AlertTriangle className="w-3 h-3" /> Error
          </p>
          <p className="text-[13px] text-neutral-300 leading-[1.6]">{error}</p>
        </div>
      )}

      {result && (
        <div
          className={`p-5 border rounded-[3px] ${
            result.ok
              ? "border-cyan-500/30 bg-cyan-500/[0.05]"
              : "border-rose-500/30 bg-rose-500/[0.05]"
          }`}
        >
          <p
            className={`flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase mb-3 ${
              result.ok ? "text-cyan-300" : "text-rose-300"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            {result.ok ? "Verified · math holds" : "Verification failed"}
          </p>
          {sth && (
            <p className="text-[12px] text-neutral-400 leading-[1.65] mb-3">
              The {result.ok ? "matching" : "MISMATCHED"} root hash recomputed
              entirely in your browser via Web Crypto SHA-256. STH source:{" "}
              <code className="text-neutral-300">/api/transparency/sth</code>{" "}
              (treeSize {sth.treeSize}).
            </p>
          )}
          <details>
            <summary className="cursor-pointer font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase hover:text-neutral-300">
              Show fold trace ({result.fold.length} SHA-256 ops)
            </summary>
            <div className="mt-3 space-y-2">
              {result.fold.map((s) => (
                <div
                  key={s.step}
                  className="p-2 bg-black/30 rounded-[3px] border border-white/[0.05]"
                >
                  <p className="font-mono text-[10px] text-neutral-500 mb-1">
                    Step {s.step}: SHA-256(0x01 || left || right)
                  </p>
                  <p className="font-mono text-[10px] text-neutral-400 break-all">
                    L: {s.left.slice(0, 24)}…
                    <br />
                    R: {s.right.slice(0, 24)}…
                    <br />
                    <span className="text-cyan-300">
                      ={s.out.slice(0, 24)}…
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </details>
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase mb-1 flex items-center gap-2">
              <Hash className="w-3 h-3" /> Final recomputed root
            </p>
            <p
              className={`font-mono text-[11px] break-all leading-[1.55] ${
                result.ok ? "text-cyan-300" : "text-rose-300"
              }`}
            >
              {result.finalRoot}
            </p>
            <p className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase mt-3 mb-1">
              Expected root (from STH)
            </p>
            <p className="font-mono text-[11px] text-neutral-300 break-all leading-[1.55]">
              {result.expectedRoot}
            </p>
          </div>
        </div>
      )}

      {proofData && !result && !error && (
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-[3px]">
          <p className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase mb-1">
            Proof fetched (verification pending)
          </p>
          <p className="text-[12px] text-neutral-400">
            {proofData.proof.length} sibling hashes · index {proofData.index}
            {" / "}size {proofData.treeSize}
          </p>
        </div>
      )}
    </form>
  );
}
