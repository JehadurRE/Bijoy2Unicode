/**
 * CloudConvert "BYOK" client with multi-key support and credit tracking.
 *
 * The user can store one or more CloudConvert API tokens in this browser.
 * Each key has its own live credit count (fetched from /v2/users/me).
 *
 * When converting, we pick the first key with credits > 0 (unknowns are
 * attempted optimistically). On insufficient-credit / 402 errors we mark the
 * key as exhausted and roll over to the next available key automatically.
 *
 * Tokens never leave the browser — there is no proxy through our server.
 *
 * Docs:
 *   https://cloudconvert.com/docs/api-reference/users
 *   https://cloudconvert.com/docs/api-reference/jobs
 */

const API_BASE = "https://api.cloudconvert.com/v2";

const KEYS_STORAGE = "bijoy2unicode.cloudconvert.keys";
const LEGACY_STORAGE = "bijoy2unicode.cloudconvert.token";

// ---------- types ----------

export interface ApiKeyEntry {
  id: string;
  label?: string;
  token: string;
  /** ISO timestamp of last /users/me check. */
  lastChecked?: string;
  /** Cached remaining credits from /users/me. */
  credits?: number;
  /** Username from CloudConvert (display only). */
  username?: string;
  /** Email from CloudConvert (display only). */
  email?: string;
  /** Status of the most recent verification attempt. */
  status: "unknown" | "ok" | "error" | "exhausted";
  /** Error message from last failed verification. */
  errorMessage?: string;
}

export interface CloudConvertProgress {
  stage: string;
  percent: number;
}

interface UploadForm {
  url: string;
  parameters: Record<string, string | number>;
}

interface CCTask {
  id: string;
  name: string;
  operation: string;
  status: "waiting" | "processing" | "finished" | "error";
  message?: string;
  result?: {
    form?: UploadForm;
    files?: Array<{ filename: string; url: string; size?: number }>;
  };
}

interface CCJob {
  id: string;
  status: "waiting" | "processing" | "finished" | "error";
  tasks: CCTask[];
}

// ---------- storage ----------

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function newId(): string {
  return (
    "k_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

export function loadKeys(): ApiKeyEntry[] {
  if (typeof window === "undefined") return [];
  let keys = safeParse<ApiKeyEntry[]>(
    window.localStorage.getItem(KEYS_STORAGE),
    []
  );

  // One-time migration of the legacy single-token storage.
  const legacy = window.localStorage.getItem(LEGACY_STORAGE);
  if (legacy && !keys.some((k) => k.token === legacy)) {
    keys = [
      {
        id: newId(),
        token: legacy,
        label: "Default",
        status: "unknown",
      },
      ...keys,
    ];
    saveKeys(keys);
  }
  if (legacy) window.localStorage.removeItem(LEGACY_STORAGE);

  return keys;
}

export function saveKeys(keys: ApiKeyEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function addKey(token: string, label?: string): ApiKeyEntry {
  const trimmed = token.trim();
  const keys = loadKeys();
  const existing = keys.find((k) => k.token === trimmed);
  if (existing) return existing;

  const entry: ApiKeyEntry = {
    id: newId(),
    token: trimmed,
    label: label?.trim() || undefined,
    status: "unknown",
  };
  saveKeys([...keys, entry]);
  return entry;
}

export function removeKey(id: string): void {
  saveKeys(loadKeys().filter((k) => k.id !== id));
}

export function updateKey(id: string, patch: Partial<ApiKeyEntry>): void {
  saveKeys(loadKeys().map((k) => (k.id === id ? { ...k, ...patch } : k)));
}

export function hasAnyKey(): boolean {
  return loadKeys().length > 0;
}

/** Return the first usable key (credits > 0 or unknown). */
export function pickAvailableKey(
  keys: ApiKeyEntry[] = loadKeys()
): ApiKeyEntry | null {
  // Prefer keys with known positive credits, then unknown, then anything else.
  const ranked = [...keys].sort((a, b) => rank(a) - rank(b));
  return ranked.find((k) => k.status !== "exhausted") || null;
}

function rank(k: ApiKeyEntry): number {
  if (k.status === "ok" && (k.credits ?? 0) > 0) return 0;
  if (k.status === "unknown") return 1;
  if (k.status === "ok") return 2; // ok but credits unknown / 0
  if (k.status === "error") return 3;
  return 4; // exhausted
}

// ---------- API helpers ----------

async function ccFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `CloudConvert API error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) msg = `${msg}: ${body.message}`;
    } catch {
      /* ignore */
    }
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  credits: number;
  created_at?: string;
}

/** Fetch /v2/users/me to verify a token and read remaining credits. */
export async function fetchUserInfo(token: string): Promise<UserInfo> {
  const res = await ccFetch<{ data: UserInfo }>(token, "/users/me", {
    method: "GET",
  });
  return res.data;
}

/** Verify a single key and persist the result. */
export async function verifyKey(id: string): Promise<ApiKeyEntry> {
  const keys = loadKeys();
  const key = keys.find((k) => k.id === id);
  if (!key) throw new Error("Key not found.");

  try {
    const info = await fetchUserInfo(key.token);
    const patch: Partial<ApiKeyEntry> = {
      lastChecked: new Date().toISOString(),
      credits: info.credits,
      username: info.username,
      email: info.email,
      status: info.credits > 0 ? "ok" : "exhausted",
      errorMessage: undefined,
    };
    updateKey(id, patch);
    return { ...key, ...patch };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verification failed.";
    const patch: Partial<ApiKeyEntry> = {
      lastChecked: new Date().toISOString(),
      status: "error",
      errorMessage: message,
    };
    updateKey(id, patch);
    return { ...key, ...patch };
  }
}

/** Verify every stored key. Runs sequentially to avoid hammering the API. */
export async function verifyAllKeys(): Promise<ApiKeyEntry[]> {
  const keys = loadKeys();
  const out: ApiKeyEntry[] = [];
  for (const k of keys) {
    out.push(await verifyKey(k.id));
  }
  return out;
}

// ---------- conversion ----------

interface ConvertOpts {
  inputFormat?: string;
  outputFormat?: string;
  onProgress?: (p: CloudConvertProgress) => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
  /** Optional list of keys to rotate through. Defaults to stored keys. */
  keys?: ApiKeyEntry[];
}

/**
 * Convert a file via CloudConvert with automatic key rotation.
 * Returns the resulting Blob plus the id of the key that succeeded.
 */
export async function convertWithCloudConvert(
  file: File,
  opts: ConvertOpts
): Promise<{ blob: Blob; usedKeyId: string }> {
  const candidates =
    opts.keys ??
    loadKeys().filter((k) => k.status !== "exhausted");

  if (candidates.length === 0) {
    throw new Error(
      "No CloudConvert API key available. Add one in Settings."
    );
  }

  // Try each candidate until one succeeds. Mark exhausted keys as we go.
  const sorted = [...candidates].sort((a, b) => rank(a) - rank(b));
  let lastError: Error | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const key = sorted[i];
    const remaining = sorted.length - i - 1;
    try {
      const blob = await runJob(file, key.token, opts);
      // Refresh credits silently (don't fail conversion if this fails).
      fetchUserInfo(key.token)
        .then((info) =>
          updateKey(key.id, {
            credits: info.credits,
            status: info.credits > 0 ? "ok" : "exhausted",
            lastChecked: new Date().toISOString(),
          })
        )
        .catch(() => {});
      return { blob, usedKeyId: key.id };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const status = (err as Error & { status?: number }).status;
      const looksExhausted =
        status === 402 ||
        /insufficient/i.test(err.message) ||
        /credits?/i.test(err.message) && /exceed|run out|insufficient/i.test(err.message);

      if (looksExhausted) {
        updateKey(key.id, {
          status: "exhausted",
          credits: 0,
          errorMessage: err.message,
          lastChecked: new Date().toISOString(),
        });
        opts.onProgress?.({
          stage: `Key "${key.label || key.username || key.id}" out of credits, trying next${
            remaining > 0 ? "..." : ""
          }`,
          percent: 10,
        });
        lastError = err;
        continue;
      }
      // Auth / other errors: surface immediately if it's clearly auth.
      if (status === 401 || status === 403) {
        updateKey(key.id, {
          status: "error",
          errorMessage: err.message,
          lastChecked: new Date().toISOString(),
        });
        lastError = err;
        if (remaining === 0) throw err;
        continue;
      }
      // Other transient errors: try next key.
      lastError = err;
      if (remaining === 0) throw err;
    }
  }

  throw lastError || new Error("All CloudConvert keys failed.");
}

async function runJob(
  file: File,
  token: string,
  opts: ConvertOpts
): Promise<Blob> {
  const {
    inputFormat = "doc",
    outputFormat = "docx",
    onProgress,
    pollIntervalMs = 1500,
    timeoutMs = 120_000,
  } = opts;

  onProgress?.({ stage: "Creating CloudConvert job", percent: 5 });
  const create = await ccFetch<{ data: CCJob }>(token, "/jobs", {
    method: "POST",
    body: JSON.stringify({
      tasks: {
        "import-file": { operation: "import/upload" },
        "convert-file": {
          operation: "convert",
          input: "import-file",
          input_format: inputFormat,
          output_format: outputFormat,
        },
        "export-file": { operation: "export/url", input: "convert-file" },
      },
      tag: "bijoy2unicode-byok",
    }),
  });

  const jobId = create.data.id;
  const importTask = create.data.tasks.find(
    (t) => t.name === "import-file" || t.operation === "import/upload"
  );
  const form = importTask?.result?.form;
  if (!form) throw new Error("CloudConvert did not return an upload form.");

  onProgress?.({ stage: "Uploading file to CloudConvert", percent: 20 });
  const fd = new FormData();
  for (const [k, v] of Object.entries(form.parameters)) {
    fd.append(k, String(v));
  }
  fd.append("file", file, file.name);

  const upload = await fetch(form.url, { method: "POST", body: fd });
  if (!upload.ok && upload.status !== 201) {
    throw new Error(`Upload to CloudConvert failed (${upload.status}).`);
  }

  const start = Date.now();
  let percent = 30;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("CloudConvert job timed out.");
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const j = await ccFetch<{ data: CCJob }>(token, `/jobs/${jobId}`, {
      method: "GET",
    });
    const job = j.data;

    if (job.status === "error") {
      const failed = job.tasks.find((t) => t.status === "error");
      throw new Error(
        failed?.message
          ? `CloudConvert: ${failed.message}`
          : "CloudConvert job failed."
      );
    }

    percent = Math.min(85, percent + 4);
    onProgress?.({
      stage:
        job.status === "finished"
          ? "Downloading converted file"
          : "Converting on CloudConvert",
      percent,
    });

    if (job.status === "finished") {
      const exportTask = job.tasks.find(
        (t) => t.name === "export-file" || t.operation === "export/url"
      );
      const file0 = exportTask?.result?.files?.[0];
      if (!file0?.url) {
        throw new Error("CloudConvert did not return a file URL.");
      }
      const dl = await fetch(file0.url);
      if (!dl.ok) {
        throw new Error(`Could not download converted file (${dl.status}).`);
      }
      onProgress?.({ stage: "Downloaded", percent: 95 });
      return await dl.blob();
    }
  }
}
