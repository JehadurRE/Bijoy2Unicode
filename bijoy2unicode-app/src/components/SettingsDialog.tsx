"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type ApiKeyEntry,
  addKey,
  loadKeys,
  removeKey,
  updateKey,
  verifyAllKeys,
  verifyKey,
} from "@/lib/cloudconvert";

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function SettingsDialog({ open, onClose, onChanged }: Props) {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [newToken, setNewToken] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setKeys(loadKeys());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onAdd = useCallback(async () => {
    const token = newToken.trim();
    if (!token) return;
    const entry = addKey(token, newLabel.trim() || undefined);
    setNewToken("");
    setNewLabel("");
    refresh();
    onChanged?.();
    setBusy(entry.id);
    try {
      await verifyKey(entry.id);
    } finally {
      setBusy(null);
      refresh();
      onChanged?.();
    }
  }, [newToken, newLabel, refresh, onChanged]);

  const onRefresh = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        await verifyKey(id);
      } finally {
        setBusy(null);
        refresh();
        onChanged?.();
      }
    },
    [refresh, onChanged]
  );

  const onRefreshAll = useCallback(async () => {
    setBusy("__all__");
    try {
      await verifyAllKeys();
    } finally {
      setBusy(null);
      refresh();
      onChanged?.();
    }
  }, [refresh, onChanged]);

  const onRemove = useCallback(
    (id: string) => {
      removeKey(id);
      refresh();
      onChanged?.();
    },
    [refresh, onChanged]
  );

  const onRename = useCallback(
    (id: string, label: string) => {
      updateKey(id, { label });
      refresh();
      onChanged?.();
    },
    [refresh, onChanged]
  );

  if (!open) return null;

  const totalCredits = keys.reduce(
    (sum, k) => sum + (typeof k.credits === "number" ? k.credits : 0),
    0
  );
  const knownCount = keys.filter((k) => typeof k.credits === "number").length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--background)] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 id="settings-title" className="text-base font-semibold">
            Settings — CloudConvert API keys
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
          <div className="flex flex-col gap-5">
            {/* Summary */}
            <section className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="Stored keys"
                value={String(keys.length)}
                hint={
                  keys.length === 0
                    ? "Add your first key below"
                    : `${keys.filter((k) => k.status === "ok").length} active`
                }
              />
              <Stat
                label="Total credits"
                value={
                  knownCount > 0 ? totalCredits.toLocaleString() : "—"
                }
                hint={
                  knownCount === 0
                    ? "Refresh to see balances"
                    : `Across ${knownCount} verified key${knownCount > 1 ? "s" : ""}`
                }
              />
              <Stat
                label="Auto-rotation"
                value={keys.length > 1 ? "Enabled" : "Off"}
                hint={
                  keys.length > 1
                    ? "Falls over to the next key when one is exhausted"
                    : "Add another key to enable"
                }
              />
            </section>

            {keys.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={onRefreshAll}
                  disabled={busy !== null}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs hover:bg-[var(--muted)] disabled:opacity-50"
                >
                  {busy === "__all__" ? "Refreshing..." : "Refresh all balances"}
                </button>
              </div>
            )}

            {/* Key list */}
            <section className="flex flex-col gap-3">
              {keys.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)] p-6 text-center text-sm text-[var(--muted-foreground)]">
                  No API keys saved yet. Paste one below.
                </p>
              ) : (
                keys.map((k) => (
                  <KeyCard
                    key={k.id}
                    entry={k}
                    busy={busy === k.id}
                    revealed={!!reveal[k.id]}
                    onToggleReveal={() =>
                      setReveal((r) => ({ ...r, [k.id]: !r[k.id] }))
                    }
                    onRefresh={() => onRefresh(k.id)}
                    onRemove={() => onRemove(k.id)}
                    onRename={(label) => onRename(k.id, label)}
                  />
                ))
              )}
            </section>

            {/* Add a new key */}
            <section className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
              <h4 className="text-sm font-medium">Add a CloudConvert API key</h4>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Tokens are stored only in this browser. Add multiple keys to
                automatically rotate when one runs out of credits.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label (optional, e.g. Personal, Work)"
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
                <textarea
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOi..."
                  rows={3}
                  className="resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs focus:border-[var(--accent)] focus:outline-none"
                  spellCheck={false}
                  autoComplete="off"
                />
                <div>
                  <button
                    onClick={onAdd}
                    disabled={!newToken.trim() || busy !== null}
                    className="inline-flex h-9 items-center rounded-full bg-[var(--accent)] px-4 text-xs font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add &amp; verify
                  </button>
                </div>
              </div>
            </section>

            {/* Help */}
            <section className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-xs text-[var(--muted-foreground)]">
              <p className="font-medium text-[var(--foreground)]">
                How to get a CloudConvert API key
              </p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                <li>
                  Sign up free at{" "}
                  <a
                    href="https://cloudconvert.com/register"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[var(--foreground)]"
                  >
                    cloudconvert.com/register
                  </a>{" "}
                  (free plan: 25 conversions/day).
                </li>
                <li>
                  Open{" "}
                  <a
                    href="https://cloudconvert.com/dashboard/api/v2/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[var(--foreground)]"
                  >
                    Dashboard → API → API Keys
                  </a>
                  .
                </li>
                <li>
                  Click <em>Create New API Key</em>. Required scopes:{" "}
                  <code className="font-mono">user.read</code>,{" "}
                  <code className="font-mono">task.read</code>,{" "}
                  <code className="font-mono">task.write</code>.
                </li>
                <li>Copy the token shown once and paste it above.</li>
              </ol>
              <p className="mt-3">
                <strong>Privacy:</strong> Tokens and uploads go directly from
                your browser to CloudConvert. Our site never sees them.
                CloudConvert auto-deletes uploaded files after 24 hours.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {hint && (
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{hint}</p>
      )}
    </div>
  );
}

function KeyCard({
  entry,
  busy,
  revealed,
  onToggleReveal,
  onRefresh,
  onRemove,
  onRename,
}: {
  entry: ApiKeyEntry;
  busy: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  onRename: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(entry.label || "");

  const masked = entry.token.length > 14
    ? `${entry.token.slice(0, 6)}…${entry.token.slice(-6)}`
    : entry.token;

  const checkedAt = entry.lastChecked
    ? new Date(entry.lastChecked).toLocaleString()
    : "Not yet";

  const dotColor =
    entry.status === "ok"
      ? "bg-emerald-500"
      : entry.status === "exhausted"
      ? "bg-amber-500"
      : entry.status === "error"
      ? "bg-red-500"
      : "bg-zinc-400";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`mt-1 size-2 shrink-0 rounded-full ${dotColor}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={() => {
                  onRename(labelDraft.trim());
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRename(labelDraft.trim());
                    setEditing(false);
                  } else if (e.key === "Escape") {
                    setLabelDraft(entry.label || "");
                    setEditing(false);
                  }
                }}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLabelDraft(entry.label || "");
                  setEditing(true);
                }}
                className="text-left text-sm font-medium hover:underline"
              >
                {entry.label || entry.username || "Unnamed key"}
              </button>
            )}
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {entry.username && (
                <>
                  <span>{entry.username}</span>
                  {entry.email && <> · {entry.email}</>}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-[var(--muted-foreground)]">Credits</p>
            <p className="text-base font-semibold tabular-nums">
              {typeof entry.credits === "number"
                ? entry.credits.toLocaleString()
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-[var(--muted)] px-2 py-1 font-mono text-[11px]">
          {revealed ? entry.token : masked}
        </code>
        <button
          type="button"
          onClick={onToggleReveal}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] hover:bg-[var(--muted)]"
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </div>

      {entry.errorMessage && entry.status !== "ok" && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {entry.errorMessage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <span>Last checked: {checkedAt}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="inline-flex items-center rounded-full border border-[var(--border)] px-3 py-1 hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {busy ? "Checking..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center rounded-full border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
