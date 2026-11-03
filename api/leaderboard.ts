/**
 * Hujan Kalori leaderboard — Vercel serverless function backed by Vercel KV
 * (Upstash Redis), using the Upstash REST API via plain fetch (no deps).
 *
 * One row per 4-letter initials (best score kept), on three boards:
 * today, this week (both in WIB / UTC+7) and all time.
 *
 *   GET  /api/leaderboard?period=day|week|all&limit=15&name=ABCD
 *        -> { period, entries, total, me: {rank, score} | null }
 *   POST /api/leaderboard { action: "start" }           -> { sid }
 *   POST /api/leaderboard { name, score, sid }          -> SubmitResponse
 *   POST /api/leaderboard { action: "end", sid, sec, why, loc, ch, g, u, kin, kout, items }
 *        -> { ok }   (one record per finished run, for the admin statistics)
 *
 * Anti-cheat: every run must start a server session; the submitted survival
 * time can't exceed the real time elapsed since that session started.
 *
 * Env (added when a KV / Upstash Redis store is connected to the project):
 * KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + _TOKEN).
 */

interface Req {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

type Period = "day" | "week" | "all";
const PERIODS: Period[] = ["day", "week", "all"];

interface Entry {
  rank: number;
  name: string;
  score: number;
  id: string;
}

interface Standing {
  rank: number | null;
  total: number;
  best: number | null;
  entries: Entry[];
}

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const KV_URL = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;

const MAX_SCORE_SEC = 3600;
// Generous per-IP limits: colleagues on the same office Wi-Fi share one public IP.
const SUBMIT_LIMIT = 40; // submissions per IP per minute
const START_LIMIT = 80; // runs started per IP per minute
const SESSION_TTL = 2 * 60 * 60; // seconds
const TOLERANCE_SEC = 3; // network latency between client start and server start
const KEEP_ALL = 10000;
const TTL = { day: 3 * 86400, week: 21 * 86400 };
const WIB_OFFSET_MS = 7 * 3600 * 1000;
const BANNED_KEY = "hk:banned";
const LOG_KEY = "hk:log";
const LOG_KEEP = 500;
// Play statistics (counted when a run starts / a score is submitted).
const STATS_TTL = 400 * 86400; // keep daily counters ~13 months
// Finished-run records (admin insights + CSV export).
const RUNS_KEY = "hk:runs";
const RUNS_KEEP = 50000;
const LOCS = ["hospital", "morning", "garden", "city"];
const WHYS = ["hp", "starve"];

/** YYYY-MM-DD on the WIB calendar. */
function wibDate(now = Date.now()): string {
  return new Date(now + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

// Initials that are not allowed on the public board (ID + EN).
const BLOCKED = new Set([
  "ANJG", "ANJR", "ANJN", "ANJI", "BABI", "BGST", "BNGS", "BANG", "TAIK", "TAII", "KONT", "KNTL",
  "MEMK", "MMEK", "JEMB", "JMBT", "PEPE", "PUKI", "LONT", "COLI", "NGEW", "NGNT", "TOLO", "GOBL",
  "BEGO", "ASUU", "PERE", "FUCK", "FUKK", "SHIT", "CUNT", "DICK", "COCK", "PUSS", "SLUT", "WHOR",
  "NIGG", "NIGA", "FAGG", "RAPE", "PORN", "SEXX", "SEKS", "TITS", "BOOB", "ANAL", "PENS", "VAGN",
]);

// ------------------------------------------------------------------ helpers

async function kv(commands: (string | number)[][]): Promise<unknown[]> {
  const r = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands.map((c) => c.map(String))),
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  const out = (await r.json()) as Array<{ result?: unknown; error?: string }>;
  return out.map((o) => {
    if (o.error) throw new Error(o.error);
    return o.result;
  });
}

/** Board key for a period, using the calendar in WIB (UTC+7). */
function boardKey(period: Period, now = Date.now()): string {
  if (period === "all") return "hk:v2:all";
  const d = new Date(now + WIB_OFFSET_MS); // read with UTC getters => WIB wall clock
  if (period === "day") return `hk:v2:d:${d.toISOString().slice(0, 10)}`;
  // ISO week (Mon–Sun)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `hk:v2:w:${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function parseRange(flat: unknown): Entry[] {
  const arr = Array.isArray(flat) ? (flat as string[]) : [];
  const entries: Entry[] = [];
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const name = String(arr[i]);
    entries.push({ rank: entries.length + 1, name, id: name, score: Number(arr[i + 1]) / 100 });
  }
  return entries;
}

const toScore = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v) / 100);
const toRank = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v) + 1);

function newSessionId(): string {
  const c = (globalThis as { crypto?: { getRandomValues(a: Uint8Array): Uint8Array } }).crypto;
  const bytes = new Uint8Array(12);
  if (c) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

function maskIp(ip: string): string {
  if (ip.includes(".")) return ip.split(".").slice(0, 3).join(".") + ".x";
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":x";
  return "?";
}

function clientIp(req: Req): string {
  const fwd = req.headers["x-forwarded-for"];
  const v = Array.isArray(fwd) ? fwd[0] : fwd;
  return (v ?? "unknown").split(",")[0].trim();
}

function q(req: Req, key: string): string | undefined {
  const v = req.query?.[key];
  return Array.isArray(v) ? v[0] : v;
}

async function rateLimited(key: string, limit: number): Promise<boolean> {
  const [, count] = await kv([
    ["SET", key, 0, "EX", 60, "NX"],
    ["INCR", key],
  ]);
  return Number(count) > limit;
}

/** One-time copy of the v1 board ("NAME:id" members) into the v2 all-time board. */
let migrated = false;
async function migrateV1(): Promise<void> {
  if (migrated) return;
  migrated = true;
  const [first] = await kv([["SET", "hk:v2:migrated", 1, "NX"]]);
  if (first !== "OK") return;
  const [old] = await kv([["ZRANGE", "hk:lb", 0, -1, "WITHSCORES"]]);
  const arr = Array.isArray(old) ? (old as string[]) : [];
  const cmds: (string | number)[][] = [];
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const name = String(arr[i]).split(":")[0];
    if (/^[A-Z]{4}$/.test(name)) cmds.push(["ZADD", boardKey("all"), "GT", arr[i + 1], name]);
  }
  if (cmds.length) await kv(cmds);
}

// ------------------------------------------------------------------ handler

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (!KV_URL || !KV_TOKEN) {
    res.status(503).json({ error: "not_configured" });
    return;
  }

  try {
    await migrateV1();

    if (req.method === "GET") {
      const period = (PERIODS as string[]).includes(q(req, "period") ?? "") ? (q(req, "period") as Period) : "all";
      const limit = Math.min(Math.max(Number(q(req, "limit")) || 15, 1), 50);
      const name = (q(req, "name") ?? "").toUpperCase();
      const key = boardKey(period);
      const cmds: (string | number)[][] = [
        ["ZREVRANGE", key, 0, limit - 1, "WITHSCORES"],
        ["ZCARD", key],
      ];
      const withMe = /^[A-Z]{4}$/.test(name);
      if (withMe) cmds.push(["ZREVRANK", key, name], ["ZSCORE", key, name]);
      const out = await kv(cmds);
      const me = withMe && out[2] !== null ? { rank: toRank(out[2]), score: toScore(out[3]) } : null;
      res.status(200).json({ period, entries: parseRange(out[0]), total: Number(out[1]), me });
      return;
    }

    if (req.method === "POST") {
      let body = req.body as Record<string, unknown> | string | undefined;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body) as Record<string, unknown>;
        } catch {
          body = undefined;
        }
      }
      const b = (body ?? {}) as Record<string, unknown>;
      const ip = clientIp(req);

      // ---- start a run
      if (b.action === "start") {
        if (await rateLimited(`hk:rls:${ip}`, START_LIMIT)) {
          res.status(429).json({ error: "rate_limited" });
          return;
        }
        const sid = newSessionId();
        const day = wibDate();
        const did = typeof b.did === "string" && /^[a-z0-9]{8,32}$/.test(b.did) ? b.did : "";
        const cmds: (string | number)[][] = [
          ["SET", `hk:s:${sid}`, Date.now(), "EX", SESSION_TTL],
          ["INCR", "hk:stats:plays"],
          ["INCR", `hk:stats:plays:${day}`],
          ["EXPIRE", `hk:stats:plays:${day}`, STATS_TTL],
        ];
        if (did) {
          // anonymous random device id -> unique-device counts (HyperLogLog)
          cmds.push(
            ["PFADD", "hk:stats:dev", did],
            ["PFADD", `hk:stats:dev:${day}`, did],
            ["EXPIRE", `hk:stats:dev:${day}`, STATS_TTL],
          );
        }
        await kv(cmds);
        res.status(200).json({ sid });
        return;
      }

      // ---- a run finished: store one anonymous record + daily aggregates
      if (b.action === "end") {
        const sid = String(b.sid ?? "");
        if (!/^[a-z0-9]{8,32}$/.test(sid)) {
          res.status(400).json({ error: "invalid_session" });
          return;
        }
        const [started, fresh] = await kv([
          ["GET", `hk:s:${sid}`],
          ["SET", `hk:e:${sid}`, 1, "NX", "EX", SESSION_TTL],
        ]);
        if (started === null || started === undefined || fresh === null) {
          // unknown session, or this run was already recorded
          res.status(200).json({ ok: false });
          return;
        }
        const realSec = (Date.now() - Number(started)) / 1000;
        const sec = Math.round(Math.min(Math.max(Number(b.sec) || 0, 0), realSec + TOLERANCE_SEC, MAX_SCORE_SEC) * 10) / 10;
        const pick = (v: unknown, list: string[], dflt: string): string => (list.includes(String(v)) ? String(v) : dflt);
        const why = pick(b.why, WHYS, "hp");
        const loc = pick(b.loc, LOCS, "hospital");
        const ch = b.ch === "auto" ? "auto" : "pilih";
        const g = b.g === "female" ? "female" : "male";
        const u = typeof b.u === "string" && /^[a-z]{2,12}$/.test(b.u) ? b.u : "";
        const kin = Math.min(Math.max(Math.round(Number(b.kin) || 0), 0), 100000);
        const kout = Math.min(Math.max(Math.round(Number(b.kout) || 0), 0), 100000);
        const items: Array<[string, number]> = [];
        if (b.items && typeof b.items === "object") {
          for (const [k, v] of Object.entries(b.items as Record<string, unknown>).slice(0, 40)) {
            const n = Math.round(Number(v));
            if (/^[a-z0-9_]{1,40}$/.test(k) && n > 0 && n <= 1000) items.push([k, n]);
          }
        }
        const now = Date.now();
        const day = wibDate(now);
        const caught = items.reduce((a, [, n]) => a + n, 0);
        const rk = `hk:run:${sid}`;
        const cmds: (string | number)[][] = [
          ["HSET", rk, "t", now, "sec", sec, "why", why, "loc", loc, "ch", ch, "g", g, "u", u, "kin", kin, "kout", kout, "caught", caught, "items", JSON.stringify(Object.fromEntries(items))],
          ["EXPIRE", rk, STATS_TTL],
          ["ZADD", RUNS_KEY, now, sid],
          ["ZREMRANGEBYRANK", RUNS_KEY, 0, -(RUNS_KEEP + 1)],
        ];
        // aggregates: all time + per WIB day
        for (const suffix of ["", `:${day}`]) {
          const ex = (k: string): void => {
            if (suffix) cmds.push(["EXPIRE", k, STATS_TTL]);
          };
          cmds.push(["INCR", `hk:stats:runs${suffix}`]);
          ex(`hk:stats:runs${suffix}`);
          cmds.push(["INCRBYFLOAT", `hk:stats:dur${suffix}`, sec]);
          ex(`hk:stats:dur${suffix}`);
          for (const [h, f] of [["loc", loc], ["why", why], ["ch", ch], ["g", g], ...(u ? [["u", u]] : [])] as Array<[string, string]>) {
            cmds.push(["HINCRBY", `hk:stats:${h}${suffix}`, f, 1]);
            ex(`hk:stats:${h}${suffix}`);
          }
          for (const [k, n] of items) cmds.push(["HINCRBY", `hk:stats:items${suffix}`, k, n]);
          if (items.length) ex(`hk:stats:items${suffix}`);
        }
        await kv(cmds);
        res.status(200).json({ ok: true });
        return;
      }

      // ---- submit a score
      const name = String(b.name ?? "").toUpperCase();
      const score = Number(b.score);
      const sid = String(b.sid ?? "");

      if (!/^[A-Z]{4}$/.test(name)) {
        res.status(400).json({ error: "invalid_name" });
        return;
      }
      if (BLOCKED.has(name)) {
        res.status(400).json({ error: "blocked_name" });
        return;
      }
      if (!Number.isFinite(score) || score < 1 || score > MAX_SCORE_SEC) {
        res.status(400).json({ error: "invalid_score" });
        return;
      }
      if (!/^[a-z0-9]{8,32}$/.test(sid)) {
        res.status(400).json({ error: "invalid_session" });
        return;
      }
      if (await rateLimited(`hk:rl:${ip}`, SUBMIT_LIMIT)) {
        res.status(429).json({ error: "rate_limited" });
        return;
      }

      // Session is single-use. Banned initials (set from the admin panel) are refused.
      const [banned, started] = await kv([
        ["SISMEMBER", BANNED_KEY, name],
        ["GETDEL", `hk:s:${sid}`],
      ]);
      if (Number(banned) === 1) {
        res.status(400).json({ error: "blocked_name" });
        return;
      }
      if (started === null || started === undefined) {
        res.status(400).json({ error: "invalid_session" });
        return;
      }
      const realSec = (Date.now() - Number(started)) / 1000;
      if (score > realSec + TOLERANCE_SEC) {
        res.status(400).json({ error: "score_mismatch" });
        return;
      }

      const now = Date.now();
      const keys = { day: boardKey("day", now), week: boardKey("week", now), all: boardKey("all", now) };
      const cs = Math.round(score * 100);

      const [prevAll] = await kv([["ZSCORE", keys.all, name]]);
      const cmds: (string | number)[][] = [
        ["ZADD", keys.day, "GT", cs, name],
        ["ZADD", keys.week, "GT", cs, name],
        ["ZADD", keys.all, "GT", cs, name],
        ["EXPIRE", keys.day, TTL.day],
        ["EXPIRE", keys.week, TTL.week],
      ];
      for (const p of PERIODS) {
        cmds.push(
          ["ZREVRANK", keys[p], name],
          ["ZCARD", keys[p]],
          ["ZSCORE", keys[p], name],
          ["ZREVRANGE", keys[p], 0, 9, "WITHSCORES"],
        );
      }
      cmds.push(["ZREMRANGEBYRANK", keys.all, 0, -(KEEP_ALL + 1)]);
      // Recent-submissions log for the admin panel (IP masked to /24).
      const log = JSON.stringify({ n: name, s: score, t: now, r: Math.round(realSec * 10) / 10, ip: maskIp(ip) });
      cmds.push(["LPUSH", LOG_KEY, log], ["LTRIM", LOG_KEY, 0, LOG_KEEP - 1]);
      // attach the initials to this run's record (if the run was recorded)
      cmds.push(["HSET", `hk:run:${sid}`, "name", name, "score", score], ["EXPIRE", `hk:run:${sid}`, STATS_TTL]);
      const day = wibDate(now);
      cmds.push(["INCR", "hk:stats:submits"], ["INCR", `hk:stats:submits:${day}`], ["EXPIRE", `hk:stats:submits:${day}`, STATS_TTL]);
      const out = await kv(cmds);

      const periods = {} as Record<Period, Standing>;
      PERIODS.forEach((p, i) => {
        const o = 5 + i * 4;
        periods[p] = {
          rank: toRank(out[o]),
          total: Number(out[o + 1]),
          best: toScore(out[o + 2]),
          entries: parseRange(out[o + 3]),
        };
      });

      const previousBest = toScore(prevAll);
      res.status(200).json({
        name,
        score,
        previousBest,
        improved: previousBest === null || cs > Math.round(previousBest * 100),
        periods,
      });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: "server_error", detail: String((e as Error).message ?? e) });
  }
}
