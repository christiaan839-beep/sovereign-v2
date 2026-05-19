"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText, Play, Loader2, AlertTriangle } from "lucide-react";

export type SchemaField =
  | {
      type: "text";
      key: string;
      label: string;
      placeholder?: string;
      required?: boolean;
      defaultValue?: string;
      hint?: string;
    }
  | {
      type: "textarea";
      key: string;
      label: string;
      placeholder?: string;
      required?: boolean;
      defaultValue?: string;
      hint?: string;
    }
  | {
      type: "select";
      key: string;
      label: string;
      options: { value: string; label: string }[];
      required?: boolean;
      defaultValue?: string;
      hint?: string;
    }
  | {
      type: "file";
      key: string;
      label: string;
      accept: string;
      required?: boolean;
      hint?: string;
      /** Maximum size in bytes. Defaults to 4 MB. */
      maxBytes?: number;
    };

export interface ComplianceShellProps {
  /** Canonical framework id, e.g. "annex-iv". */
  framework: string;
  /** Human-readable framework name. */
  frameworkLabel: string;
  /** One-paragraph description rendered under the title. */
  description: string;
  /** Public-preview URL for this framework. */
  previewUrl: string;
  /** npm package name backing this exporter. */
  npmPackage: string;
  /** Operator-supplied scope fields. */
  fields: SchemaField[];
  /** Whether the DB is currently healthy (real receipts) or degraded (sample). */
  dataMode: "live" | "sample" | "no-receipts";
  /** Receipt count the dashboard saw at render time. */
  receiptCount: number;
  /** Reporting window string. */
  reportingWindow: string;
}

export function CompliancePageShell(props: ComplianceShellProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of props.fields) {
      // File fields have no defaultValue — initialise empty.
      init[f.key] = f.type === "file" ? "" : (f.defaultValue ?? "");
    }
    return init;
  });
  const [phase, setPhase] = useState<"idle" | "running" | "result" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    markdown: string;
    json: string;
  } | null>(null);

  async function generate() {
    setPhase("running");
    setError(null);
    setReport(null);
    try {
      const res = await fetch(
        `/api/_admin/compliance/${props.framework}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: formValues }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        markdown: string;
        json: string;
      };
      setReport(data);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight">
            {props.frameworkLabel}
          </h1>
          <Link
            href={props.previewUrl}
            className="text-[12px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            ← Public preview
          </Link>
        </div>
        <p className="text-[14px] text-neutral-400 max-w-3xl leading-relaxed">
          {props.description}
        </p>
      </div>

      {/* Data-source banner */}
      {props.dataMode !== "live" && (
        <div className="rounded-[6px] border border-amber-500/30 bg-amber-500/[0.04] px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-4 h-4 text-amber-400 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-amber-300 mb-1">
                {props.dataMode === "sample"
                  ? "Currently generating against sample receipts"
                  : "No receipts found in your tenant"}
              </p>
              <p className="text-[12px] text-neutral-400 leading-relaxed">
                {props.dataMode === "sample"
                  ? "Database is unreachable or the tenant has no receipts yet. The exporter is using a 412-receipt sample set so you can see the output shape. Wire your AI calls through one of the @sovereign-matrix/*-receipts SDK wrappers to start producing real receipts."
                  : "Once you start minting receipts via the SDK wrappers, this dashboard will generate the report against your real production data. Until then, the form below works against an in-memory sample so you can preview the output shape."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Receipt-source summary */}
      <div className="grid sm:grid-cols-3 gap-3 text-[12px]">
        <Stat label="Data source" value={props.dataMode} />
        <Stat
          label="Receipts in scope"
          value={props.receiptCount.toLocaleString()}
        />
        <Stat label="Reporting window" value={props.reportingWindow} />
      </div>

      {/* Form */}
      <section>
        <h2 className="font-serif text-2xl mb-4 tracking-tight">
          Operator-supplied scope
        </h2>
        <p className="text-[13px] text-neutral-500 mb-5 max-w-2xl">
          Fields{" "}
          {props.fields.some((f) => f.required) ? "marked with *" : "below"}{" "}
          feed the exporter&apos;s `scope` parameter. The receipt-derived
          sections are filled automatically; this is the operator-authored
          metadata that goes alongside.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {props.fields.map((field) => (
            <div
              key={field.key}
              className={
                field.type === "textarea" || field.type === "file"
                  ? "sm:col-span-2"
                  : ""
              }
            >
              <label
                htmlFor={field.key}
                className="block text-[12px] font-mono uppercase tracking-[0.14em] text-neutral-500 mb-1.5"
              >
                {field.label}
                {field.required && (
                  <span className="text-[#B5532C] ml-1">*</span>
                )}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={field.key}
                  value={formValues[field.key] ?? ""}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      [field.key]: e.target.value,
                    })
                  }
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 rounded-[4px] bg-black/40 border border-white/[0.08] text-[13px] text-white placeholder:text-neutral-600 focus:outline-none focus-visible:border-[#B5532C]/50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-colors resize-y"
                />
              ) : field.type === "select" ? (
                <select
                  id={field.key}
                  value={formValues[field.key] ?? ""}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      [field.key]: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-[4px] bg-black/40 border border-white/[0.08] text-[13px] text-white focus:outline-none focus-visible:border-[#B5532C]/50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-colors"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "file" ? (
                <FileInput
                  fieldKey={field.key}
                  accept={field.accept}
                  maxBytes={field.maxBytes ?? 4 * 1024 * 1024}
                  currentValue={formValues[field.key] ?? ""}
                  onChange={(content) =>
                    setFormValues({
                      ...formValues,
                      [field.key]: content,
                    })
                  }
                />
              ) : (
                <input
                  id={field.key}
                  type="text"
                  value={formValues[field.key] ?? ""}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      [field.key]: e.target.value,
                    })
                  }
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 rounded-[4px] bg-black/40 border border-white/[0.08] text-[13px] text-white placeholder:text-neutral-600 focus:outline-none focus-visible:border-[#B5532C]/50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-colors"
                />
              )}
              {field.hint && (
                <p className="text-[11px] text-neutral-600 mt-1">
                  {field.hint}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={generate}
            disabled={phase === "running"}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {phase === "running" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Generate report
              </>
            )}
          </button>
          <Link
            href={props.previewUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            See public sample
          </Link>
        </div>
      </section>

      {phase === "error" && error && (
        <div
          role="alert"
          className="rounded-[6px] border border-red-500/30 bg-red-500/[0.06] px-5 py-4"
        >
          <p className="text-[13px] text-red-300 font-medium mb-1">
            Generation failed
          </p>
          <p className="text-[12px] text-neutral-400 font-mono">{error}</p>
        </div>
      )}

      {phase === "result" && report && (
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-serif text-2xl tracking-tight">
              Report generated
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    report.markdown,
                    `${props.framework}-${new Date()
                      .toISOString()
                      .slice(0, 10)}.md`,
                    "text/markdown",
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 border border-cyan-500/30 text-cyan-300 font-mono text-[12px] rounded-[3px] hover:bg-cyan-500/[0.06] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Markdown
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    report.json,
                    `${props.framework}-${new Date()
                      .toISOString()
                      .slice(0, 10)}.json`,
                    "application/json",
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 border border-cyan-500/30 text-cyan-300 font-mono text-[12px] rounded-[3px] hover:bg-cyan-500/[0.06] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          </div>
          <p className="text-[12px] text-neutral-500 mb-4 max-w-2xl">
            Generated by{" "}
            <code className="text-cyan-300/80 text-[11px]">
              {props.npmPackage}
            </code>{" "}
            against the {props.dataMode} receipt set. Byte-deterministic — your
            auditor can re-derive these numbers from the same receipts.
          </p>
          <div className="rounded-[6px] border border-white/[0.06] bg-black/40 max-h-[640px] overflow-y-auto">
            <pre className="px-5 py-4 font-mono text-[11px] leading-[1.55] text-neutral-300 whitespace-pre-wrap break-words">
              {report.markdown.slice(0, 6000)}
              {report.markdown.length > 6000 &&
                "\n\n… (truncated in viewer — full output in the .md download)"}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500 mb-1">
        {label}
      </p>
      <p className="text-neutral-200 text-[13px] font-mono">{value}</p>
    </div>
  );
}

interface FileInputProps {
  fieldKey: string;
  accept: string;
  maxBytes: number;
  currentValue: string;
  onChange: (content: string) => void;
}

function FileInput({
  fieldKey,
  accept,
  maxBytes,
  currentValue,
  onChange,
}: FileInputProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasValue = currentValue.length > 0;

  function handleFile(file: File | null): void {
    setError(null);
    if (!file) {
      setFileName(null);
      onChange("");
      return;
    }
    if (file.size > maxBytes) {
      setError(
        `File is ${(file.size / 1024).toFixed(1)} KB; max is ${(maxBytes / 1024).toFixed(0)} KB.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setFileName(file.name);
      onChange(text);
    };
    reader.onerror = () => {
      setError("Could not read the file.");
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <label
        htmlFor={fieldKey}
        className="block rounded-[4px] border border-dashed border-white/[0.12] hover:border-cyan-500/40 bg-black/40 px-4 py-5 cursor-pointer transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-[13px] text-neutral-300">
            {fileName ? (
              <>
                <span className="text-cyan-300/90 font-mono">✓ {fileName}</span>{" "}
                <span className="text-[11px] text-neutral-500">
                  ({Math.round(currentValue.length / 1024)} KB parsed)
                </span>
              </>
            ) : (
              <>Click to upload or drop a file here</>
            )}
          </span>
          <span className="text-[10px] font-mono text-neutral-600">
            {accept}
          </span>
        </div>
        <input
          id={fieldKey}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {hasValue && fileName === null && (
        <p className="text-[11px] text-neutral-500 mt-1">
          Loaded {Math.round(currentValue.length / 1024)} KB from previous
          upload.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-red-300 font-mono mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
