"use client";

import { useEffect, useMemo, useState } from "react";

const REPORT_EMAIL = "emran.jehadur@gmail.com";

export interface ReportContext {
  /** Original file name. */
  fileName: string;
  /** File extension (docx, doc, odt, ...). */
  ext: string;
  /** File size in KB. */
  sizeKb: number;
  /**
   * Map of unmapped/suspicious characters → number of occurrences in the
   * converted output. Empty if none were detected.
   */
  unmapped: Map<string, number>;
  /**
   * Up to ~500 chars of converted output around the suspicious chars (for
   * paste-back). Empty if not available.
   */
  contextSnippet?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  context: ReportContext | null;
}

function describeCp(ch: string): string {
  const cp = ch.codePointAt(0)!;
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

function buildBody(ctx: ReportContext, userNote: string): string {
  const lines: string[] = [];
  lines.push("Hi,");
  lines.push("");
  lines.push(
    "I found a Bijoy file that did not convert cleanly with bijoy2unicode."
  );
  lines.push("");
  lines.push("---- File ----");
  lines.push(`Name : ${ctx.fileName}`);
  lines.push(`Type : .${ctx.ext}`);
  lines.push(`Size : ${ctx.sizeKb} KB`);
  lines.push("");
  if (ctx.unmapped.size > 0) {
    lines.push("---- Unmapped characters detected ----");
    const rows = Array.from(ctx.unmapped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    for (const [ch, count] of rows) {
      lines.push(`${describeCp(ch)}  '${ch}'  × ${count}`);
    }
    lines.push("");
  } else {
    lines.push("---- No unmapped characters detected ----");
    lines.push("(reporting because the output looks wrong)");
    lines.push("");
  }
  if (ctx.contextSnippet) {
    lines.push("---- Context (converted output snippet) ----");
    lines.push(ctx.contextSnippet);
    lines.push("");
  }
  if (userNote.trim()) {
    lines.push("---- My notes ----");
    lines.push(userNote.trim());
    lines.push("");
  }
  lines.push(
    "I'll attach the original file to this email if I can share it."
  );
  lines.push("");
  lines.push("Thanks!");
  return lines.join("\n");
}

function buildSubject(ctx: ReportContext): string {
  if (ctx.unmapped.size > 0) {
    const sample = Array.from(ctx.unmapped.keys()).slice(0, 3).map(describeCp).join(",");
    return `[bijoy2unicode] Unmapped characters in ${ctx.fileName} (${sample})`;
  }
  return `[bijoy2unicode] Conversion issue with ${ctx.fileName}`;
}

export default function ReportDialog({ open, onClose, context }: Props) {
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setNote("");
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const subject = useMemo(
    () => (context ? buildSubject(context) : ""),
    [context]
  );
  const body = useMemo(
    () => (context ? buildBody(context, note) : ""),
    [context, note]
  );
  const mailto = useMemo(() => {
    if (!context) return "";
    return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [context, subject, body]);

  if (!open || !context) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${REPORT_EMAIL}\nSubject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 id="report-title" className="text-base font-semibold">
            Report a conversion issue
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            We&rsquo;ll prefill an email to{" "}
            <a
              href={`mailto:${REPORT_EMAIL}`}
              className="underline hover:text-[var(--foreground)]"
            >
              {REPORT_EMAIL}
            </a>{" "}
            with the file metadata and the bytes that didn&rsquo;t map. Add an
            optional note and attach the original file in your mail client.
          </p>

          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-xs">
            <p>
              <span className="text-[var(--muted-foreground)]">Subject:</span>{" "}
              <span className="font-mono">{subject}</span>
            </p>
          </div>

          {context.unmapped.size > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium">Unmapped characters detected</p>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
                <table className="w-full text-xs">
                  <thead className="text-[var(--muted-foreground)]">
                    <tr>
                      <th className="text-left font-normal">Codepoint</th>
                      <th className="text-left font-normal">Char</th>
                      <th className="text-right font-normal">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(context.unmapped.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([ch, count]) => (
                        <tr key={ch} className="border-t border-[var(--border)]">
                          <td className="py-1 font-mono">{describeCp(ch)}</td>
                          <td className="py-1 font-mono">
                            &lsquo;{ch}&rsquo;
                          </td>
                          <td className="py-1 text-right tabular-nums">
                            {count}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-xs text-[var(--muted-foreground)]">
              No unmapped Bijoy bytes were detected automatically. If the
              output still looks wrong (missing conjuncts, weird spacing, etc.),
              describe what you expected below and attach the file.
            </p>
          )}

          <label className="mt-4 block text-xs">
            <span className="block font-medium">Optional note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Anything specific? Page number, expected text, the font used, etc."
              className="mt-1 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={mailto}
              className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
            >
              Open in email client
            </a>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex h-10 items-center rounded-full border border-[var(--border)] px-5 text-sm font-medium hover:bg-[var(--muted)]"
            >
              {copied ? "Copied ✓" : "Copy report"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
