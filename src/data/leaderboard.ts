/**
 * Client for the public leaderboard (`/api/leaderboard`, Vercel KV).
 * No login: players sign scores with 4-letter arcade initials; each initials
 * keeps its best score on three boards — today, this week (WIB) and all time.
 *
 * If the API isn't reachable (local `vite` dev, KV not connected, offline) it
 * falls back to a per-device local board so the flow still works.
 */

export type Period = "day" | "week" | "all";
export const PERIODS: Period[] = ["day", "week", "all"];
export const PERIOD_LABEL: Record<Period, string> = { day: "Hari Ini", week: "Minggu Ini", all: "Semua" };

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  id: string;
}

export interface Standing {
  rank: number | null;
  total: number;
  best: number | null;
  entries: LeaderboardEntry[];
}

export interface BoardResult {
  entries: LeaderboardEntry[];
  total: number;
  me: { rank: number; score: number } | null;
  online: boolean;
}

export interface SubmitResult {
  ok: boolean;
  online: boolean;
  error?: string;
  improved?: boolean;
  previousBest?: number | null;
  periods?: Record<Period, Standing>;
}

const API = `${(import.meta.env.VITE_API_BASE as string | undefined) ?? ""}/api/leaderboard`;
const INITIALS_KEY = "hk_initials";
const LOCAL_KEY = "hk_local_runs";
const BEST_KEY = "hk_best";
const WIB_OFFSET_MS = 7 * 3600 * 1000;

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

type ApiError = Error & { code?: string; status?: number };

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

/** A real answer from our server (vs. network / not deployed / not configured). */
function isServerAnswer(e: unknown): boolean {
  const err = e as ApiError;
  return !!err.status && err.status !== 503;
}

// ------------------------------------------------------------ local fallback

interface LocalRun {
  name: string;
  score: number;
  at: number;
}

function readRuns(): LocalRun[] {
  try {
    const arr = JSON.parse(store()?.getItem(LOCAL_KEY) ?? "[]") as LocalRun[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function periodStart(period: Period, now = Date.now()): number {
  if (period === "all") return 0;
  const d = new Date(now + WIB_OFFSET_MS);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - WIB_OFFSET_MS;
  if (period === "day") return midnight;
  const dow = d.getUTCDay() || 7; // Monday = 1
  return midnight - (dow - 1) * 86400000;
}

function localStanding(period: Period, name?: string, limit = 10): Standing {
  const from = periodStart(period);
  const best = new Map<string, number>();
  for (const r of readRuns()) {
    if (r.at < from) continue;
    best.set(r.name, Math.max(best.get(r.name) ?? 0, r.score));
  }
  const all = [...best.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([n, s], i) => ({ rank: i + 1, name: n, score: s, id: n }));
  const mine = name ? all.find((e) => e.name === name) : undefined;
  return { rank: mine?.rank ?? null, total: all.length, best: mine?.score ?? null, entries: all.slice(0, limit) };
}

function saveLocalRun(name: string, score: number): void {
  const runs = [...readRuns(), { name, score, at: Date.now() }].slice(-300);
  store()?.setItem(LOCAL_KEY, JSON.stringify(runs));
}

// ------------------------------------------------------------------- public

/** Ask the server to open a run session. Null when offline/unavailable. */
/** Anonymous random id for this browser (no personal data) — for unique-device counts. */
function deviceId(): string {
  const KEY = "hk_did";
  let id = store()?.getItem(KEY) ?? "";
  if (!/^[a-z0-9]{8,32}$/.test(id)) {
    id = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
    store()?.setItem(KEY, id);
  }
  return id;
}

export async function startRun(): Promise<string | null> {
  try {
    const { sid } = await api<{ sid: string }>({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", did: deviceId() }),
    });
    return sid ?? null;
  } catch {
    return null;
  }
}

export async function fetchBoard(period: Period, limit = 15, name = getSavedInitials()): Promise<BoardResult> {
  const nameQ = /^[A-Z]{4}$/.test(name) ? `&name=${name}` : "";
  try {
    const r = await api<{ entries: LeaderboardEntry[]; total: number; me: { rank: number; score: number } | null }>(
      undefined,
      `?period=${period}&limit=${limit}${nameQ}`,
    );
    return { ...r, online: true };
  } catch {
    const s = localStanding(period, name, limit);
    return {
      entries: s.entries,
      total: s.total,
      me: s.rank && s.best !== null ? { rank: s.rank, score: s.best } : null,
      online: false,
    };
  }
}

export async function submitScore(name: string, seconds: number, sid: string | null): Promise<SubmitResult> {
  const score = Math.round(seconds * 100) / 100;
  saveInitials(name);

  if (sid) {
    try {
      const r = await api<{ improved: boolean; previousBest: number | null; periods: Record<Period, Standing> }>({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score, sid }),
      });
      return { ok: true, online: true, ...r };
    } catch (e) {
      if (isServerAnswer(e)) {
        const err = e as ApiError;
        return { ok: false, online: true, error: err.code ?? err.message };
      }
      // fall through to local
    }
  }

  const prev = localStanding("all", name).best;
  saveLocalRun(name, score);
  const periods = {} as Record<Period, Standing>;
  for (const p of PERIODS) periods[p] = localStanding(p, name);
  return { ok: true, online: false, improved: prev === null || score > prev, previousBest: prev, periods };
}
