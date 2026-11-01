/**
 * Client for the public leaderboard (`/api/leaderboard`, Vercel KV).
 * No login: players sign scores with 4-letter arcade initials.
 *
 * If the API isn't reachable (local `vite` dev, KV not connected yet, offline)
 * it falls back to a per-device local board so the flow still works.
 */

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  id: string;
}

export interface BoardResult {
  entries: LeaderboardEntry[];
  online: boolean;
}

export interface SubmitResult extends BoardResult {
  ok: boolean;
  id?: string;
  rank?: number;
  error?: string;
}

const API = `${(import.meta.env.VITE_API_BASE as string | undefined) ?? ""}/api/leaderboard`;
const INITIALS_KEY = "hk_initials";
const LOCAL_KEY = "hk_local_lb";
const BEST_KEY = "hk_best";

// Mirror of the server blocklist so the player gets instant feedback.
const BLOCKED = new Set([
  "ANJG", "ANJR", "ANJN", "ANJI", "BABI", "BGST", "BNGS", "BANG", "TAIK", "TAII", "KONT", "KNTL",
  "MEMK", "MMEK", "JEMB", "JMBT", "PEPE", "PUKI", "LONT", "COLI", "NGEW", "NGNT", "TOLO", "GOBL",
  "BEGO", "ASUU", "PERE", "FUCK", "FUKK", "SHIT", "CUNT", "DICK", "COCK", "PUSS", "SLUT", "WHOR",
  "NIGG", "NIGA", "FAGG", "RAPE", "PORN", "SEXX", "SEKS", "TITS", "BOOB", "ANAL", "PENS", "VAGN",
]);

export function isNameAllowed(name: string): boolean {
  return /^[A-Z]{4}$/.test(name) && !BLOCKED.has(name);
}

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getSavedInitials(): string {
  const v = store()?.getItem(INITIALS_KEY) ?? "";
  return /^[A-Z]{1,4}$/.test(v) ? v : "";
}

export function saveInitials(name: string): void {
  store()?.setItem(INITIALS_KEY, name);
}

/** Records a run locally; returns true when it beats this device's best. */
export function recordPersonalBest(seconds: number): { best: number; isNew: boolean } {
  const prev = Number(store()?.getItem(BEST_KEY) ?? 0) || 0;
  const isNew = seconds > prev && seconds >= 1;
  if (isNew) store()?.setItem(BEST_KEY, seconds.toFixed(2));
  return { best: Math.max(prev, seconds), isNew };
}

async function api<T>(init?: RequestInit, query = ""): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(API + query, { ...init, signal: ctrl.signal });
    const type = r.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) throw new Error("no_api");
    const body = (await r.json()) as T & { error?: string };
    if (!r.ok) throw Object.assign(new Error(body.error ?? `http_${r.status}`), { code: body.error, status: r.status });
    return body;
  } finally {
    window.clearTimeout(timer);
  }
}

// ------------------------------------------------------------ local fallback

function readLocal(): LeaderboardEntry[] {
  try {
    const arr = JSON.parse(store()?.getItem(LOCAL_KEY) ?? "[]") as LeaderboardEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: LeaderboardEntry[]): void {
  store()?.setItem(LOCAL_KEY, JSON.stringify(entries.slice(0, 50)));
}

function ranked(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ------------------------------------------------------------------- public

export async function fetchTop(limit = 20): Promise<BoardResult> {
  try {
    const { entries } = await api<{ entries: LeaderboardEntry[] }>(undefined, `?limit=${limit}`);
    return { entries, online: true };
  } catch {
    return { entries: ranked(readLocal()).slice(0, limit), online: false };
  }
}

export async function submitScore(name: string, seconds: number): Promise<SubmitResult> {
  const score = Math.round(seconds * 100) / 100;
  saveInitials(name);
  try {
    const r = await api<{ id: string; rank: number; entries: LeaderboardEntry[] }>({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score }),
    });
    return { ok: true, online: true, ...r };
  } catch (e) {
    const err = e as Error & { code?: string; status?: number };
    // A real server answer (bad name, rate limit…) — don't silently save locally.
    if (err.status && err.status !== 503) {
      return { ok: false, online: true, entries: [], error: err.code ?? err.message };
    }
    const id = Math.random().toString(36).slice(2, 10);
    const all = ranked([...readLocal(), { rank: 0, name, score, id }]);
    writeLocal(all);
    const mine = all.find((x) => x.id === id);
    return { ok: true, online: false, id, rank: mine?.rank, entries: all.slice(0, 10) };
  }
}
