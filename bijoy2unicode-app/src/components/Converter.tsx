"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  convertFile,
  detectExt,
  extractPlainText,
  type SupportedExt,
} from "@/lib/format-converters";
import {
  convertBijoyToUnicode,
  isSuspiciousLeftover,
  scanUnmapped,
} from "@/lib/bijoy-to-unicode";
import { loadKeys, type ApiKeyEntry } from "@/lib/cloudconvert";
import SettingsDialog from "./SettingsDialog";
import ReportDialog, { type ReportContext } from "./ReportDialog";

type Status =
  | { kind: "idle" }
  | { kind: "working"; stage: string; percent: number }
  | {
      kind: "done";
      url: string;
      filename: string;
      sizeKb: number;
      notes?: string[];
      unmapped?: Map<string, number>;
      reportContext?: ReportContext;
    }
  | { kind: "error"; message: string };

const ACCEPTED = ".docx,.doc,.odt,.rtf,.html,.htm,.txt";
const SUPPORTED_BADGES = [".docx", ".doc", ".odt", ".rtf", ".html", ".txt"];
const FORCE_CONVERT_KEY = "bijoy2unicode.forceConvert";

/**
 * Pull a small snippet of converted text surrounding the first occurrence of
 * any unmapped Bijoy byte. Used to give the report email helpful context.
 */
function buildSnippet(plain: string, unmapped: Map<string, number>): string {
  if (!plain || unmapped.size === 0) return "";
  for (let i = 0; i < plain.length; i++) {
    if (isSuspiciousLeftover(plain[i])) {
      const start = Math.max(0, i - 60);
      const end = Math.min(plain.length, i + 60);
      let s = plain.slice(start, end).replace(/\s+/g, " ").trim();
      if (start > 0) s = "…" + s;
      if (end < plain.length) s += "…";
      return s;
    }
  }
  return "";
}

export default function Converter() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewIn, setPreviewIn] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [forceConvert, setForceConvert] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted state on mount.
  useEffect(() => {
    setKeys(loadKeys());
    try {
      const savedForce = window.localStorage.getItem(FORCE_CONVERT_KEY);
      setForceConvert(savedForce === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const refreshKeys = useCallback(() => {
    setKeys(loadKeys());
  }, []);

  const hasKeys = keys.length > 0;
  const activeCredits = useMemo(
    () =>
      keys
        .filter((k) => k.status !== "exhausted")
        .reduce(
          (sum, k) => sum + (typeof k.credits === "number" ? k.credits : 0),
          0
        ),
    [keys]
  );
  const knownCreditCount = keys.filter(
    (k) => typeof k.credits === "number"
  ).length;

  const onToggleForce = useCallback((checked: boolean) => {
    setForceConvert(checked);
    try {
      window.localStorage.setItem(FORCE_CONVERT_KEY, checked ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      const ext = detectExt(file.name);
      if (!ext) {
        setStatus({
          kind: "error",
          message:
            "Unsupported file type. Please upload .docx, .doc, .odt, .rtf, .html, or .txt.",
        });
        return;
      }
      setStatus({ kind: "working", stage: "Preparing", percent: 0 });

      try {
        // .doc is automatically routed to CloudConvert whenever a key is
        // available — that's the only way to preserve per-run font info,
        // which the strict-font detector needs to skip English correctly.
        const useCloud = ext === "doc" && keys.length > 0;

        const result = await convertFile(
          file,
          (info) =>
            setStatus({
              kind: "working",
              stage: info.stage,
              percent: info.percent,
            }),
          { useCloudConvert: useCloud, forceConvert }
        );
        const url = URL.createObjectURL(result.blob);

        // Scan the converted output for leftover Bijoy bytes so we can let
        // the user report unmapped characters.
        let unmapped: Map<string, number> | undefined;
        let reportContext: ReportContext | undefined;
        try {
          const plain = await extractPlainText(
            result.blob,
            (ext === "doc" ? "docx" : ext) as SupportedExt
          );
          unmapped = scanUnmapped(plain);
          reportContext = {
            fileName: file.name,
            ext,
            sizeKb: Math.max(1, Math.round(result.blob.size / 1024)),
            unmapped,
            contextSnippet: buildSnippet(plain, unmapped),
          };
        } catch {
          // Non-fatal: scanning is best-effort.
        }

        setStatus({
          kind: "done",
          url,
          filename: result.filename,
          sizeKb: Math.max(1, Math.round(result.blob.size / 1024)),
          notes: result.notes,
          unmapped,
          reportContext,
        });
        if (useCloud) refreshKeys();
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Something went wrong while converting.";
        setStatus({ kind: "error", message });
      }
    },
    [forceConvert, keys.length, refreshKeys]
  );

  const onPick = useCallback(() => inputRef.current?.click(), []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const reset = useCallback(() => {
    if (status.kind === "done") URL.revokeObjectURL(status.url);
    setStatus({ kind: "idle" });
    setFileName(null);
  }, [status]);

  const livePreview = useMemo(
    () => convertBijoyToUnicode(previewIn),
    [previewIn]
  );

  return (
    <>
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChanged={refreshKeys}
      />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        context={status.kind === "done" ? status.reportContext ?? null : null}
      />

      <section
        id="converter"
        aria-labelledby="converter-heading"
        className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-5 sm:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="converter-heading" className="text-xl font-semibold">
              Convert your file
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Upload a Bijoy-encoded file. It runs entirely in your browser.
              Nothing is uploaded.
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-xs font-medium hover:bg-[var(--muted)]"
            aria-label="Open settings"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
            {hasKeys && knownCreditCount > 0 && (
              <span className="ml-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 font-mono text-[10px] text-[var(--accent)]">
                {activeCredits.toLocaleString()} cr
              </span>
            )}
            {hasKeys && knownCreditCount === 0 && (
              <span className="ml-1 size-1.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUPPORTED_BADGES.map((ext) => (
            <span
              key={ext}
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-0.5 font-mono text-xs text-[var(--muted-foreground)]"
            >
              {ext}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs">
          <p className="font-medium text-[var(--foreground)]">
            Legacy <code>.doc</code> handling
          </p>
          {hasKeys ? (
            <p className="mt-1 text-[var(--muted-foreground)]">
              Detected{" "}
              <span className="font-mono text-[var(--foreground)]">
                {keys.length}
              </span>{" "}
              CloudConvert key
              {keys.length === 1 ? "" : "s"}
              {knownCreditCount > 0 && (
                <>
                  {" "}with{" "}
                  <span className="font-mono text-[var(--foreground)]">
                    {activeCredits.toLocaleString()}
                  </span>{" "}
                  credits available
                </>
              )}
              . <code>.doc</code> files are sent directly from this browser to
              CloudConvert for a high-fidelity <code>.docx</code> upgrade
              (preserving per-run fonts), then the Bijoy → Unicode pass runs
              locally.
            </p>
          ) : (
            <p className="mt-1 text-[var(--muted-foreground)]">
              No CloudConvert key configured, so <code>.doc</code> files use a
              fast in-browser text-only fallback that loses per-run font info.{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setSettingsOpen(true);
                }}
                className="underline hover:text-[var(--foreground)]"
              >
                Add a free key in Settings
              </button>{" "}
              to switch to the high-fidelity path automatically.
            </p>
          )}
        </div>

        <label className="mt-3 flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs">
          <input
            type="checkbox"
            checked={forceConvert}
            onChange={(e) => onToggleForce(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span className="flex-1">
            <span className="block font-medium text-[var(--foreground)]">
              Force convert (treat all text as Bijoy)
            </span>
            <span className="text-[var(--muted-foreground)]">
              By default we only convert text that is set in a known Bijoy font
              (Sutonny MJ family, etc.) — this keeps English untouched. Turn
              this on if your Bijoy text was typed in a generic font like Times
              New Roman, or for plain <code>.txt</code>/<code>.rtf</code>/
              <code>.doc</code> files where no font information is available.
            </span>
          </span>
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent)]/5"
              : "border-[var(--border)] bg-[var(--background)]"
          }`}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            className="text-[var(--muted-foreground)]"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V4.5m0 0L7.5 9m4.5-4.5L16.5 9M4.5 19.5h15"
            />
          </svg>
          <p className="text-sm">
            <button
              type="button"
              onClick={onPick}
              className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Choose a file
            </button>{" "}
            or drag &amp; drop here
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Supported: .docx, .doc, .odt, .rtf, .html, .txt · Recommended max 25 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.currentTarget.value = "";
            }}
          />
          {fileName && (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Selected: <span className="font-mono">{fileName}</span>
            </p>
          )}
        </div>

        <div aria-live="polite" className="mt-4">
          {status.kind === "working" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span>{status.stage}</span>
                <span className="tabular-nums text-[var(--muted-foreground)]">
                  {status.percent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full bg-[var(--accent)] transition-[width] duration-200"
                  style={{ width: `${status.percent}%` }}
                />
              </div>
            </div>
          )}

          {status.kind === "done" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">Conversion complete.</p>
                  <p className="text-[var(--muted-foreground)]">
                    {status.filename} · {status.sizeKb} KB
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={status.url}
                    download={status.filename}
                    className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
                  >
                    Download
                  </a>
                  <button
                    onClick={reset}
                    className="inline-flex h-10 items-center rounded-full border border-[var(--border)] px-5 text-sm font-medium hover:bg-[var(--muted)]"
                  >
                    Convert another
                  </button>
                </div>
              </div>
              {status.unmapped && status.unmapped.size > 0 && (
                <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    <span className="font-medium">Heads up.</span> The output
                    still contains{" "}
                    <span className="font-mono">{status.unmapped.size}</span>{" "}
                    likely-unmapped Bijoy character
                    {status.unmapped.size === 1 ? "" : "s"}. Help us fix this
                    by reporting it.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="inline-flex h-8 shrink-0 items-center rounded-full bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-400 dark:text-amber-950"
                  >
                    Report this issue
                  </button>
                </div>
              )}
              {status.notes?.length ? (
                <ul className="list-disc rounded-md border border-amber-300 bg-amber-50 px-5 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {status.notes.map((n, i) => (
                    <li key={i} className="ml-2">
                      {n}
                    </li>
                  ))}
                </ul>
              ) : null}
              {status.reportContext && (!status.unmapped || status.unmapped.size === 0) && (
                <p className="text-right text-xs text-[var(--muted-foreground)]">
                  Output looks wrong?{" "}
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="underline hover:text-[var(--foreground)]"
                  >
                    Report an issue
                  </button>
                </p>
              )}
            </div>
          )}

          {status.kind === "error" && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {status.message}
            </div>
          )}
        </div>

        <details className="mt-8 group">
          <summary className="cursor-pointer text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            Try a quick text preview ↓
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs">
              <span className="text-[var(--muted-foreground)]">
                Bijoy / Sutonny MJ input
              </span>
              <textarea
                value={previewIn}
                onChange={(e) => setPreviewIn(e.target.value)}
                rows={6}
                placeholder="Paste Bijoy-encoded text here..."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs">
              <span className="text-[var(--muted-foreground)]">
                Unicode output
              </span>
              <textarea
                value={livePreview}
                readOnly
                rows={6}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm focus:border-[var(--accent)] focus:outline-none"
                style={{
                  fontFamily:
                    "Nikosh, SolaimanLipi, 'Noto Sans Bengali', sans-serif",
                }}
              />
            </label>
          </div>
        </details>
      </section>
    </>
  );
}
