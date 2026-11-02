/**
 * Hujan Kalori — admin API for moderating the leaderboard.
 * Protected by the ADMIN_PASSWORD env var (set it in Vercel → Settings →
 * Environment Variables). Requests send it in the `x-admin-key` header.
 *
 *   GET  /api/admin?period=day|week|all&limit=200&q=AB
 *        -> { summary, period, entries, total, banned, log }
 *   POST /api/admin { action: "login" }                       -> { ok }
 *   POST /api/admin { action: "delete", name, periods: [...] } -> { ok }
 *   POST /api/admin { action: "ban", name }                   -> { ok }  (also removes from all boards)
 *   POST /api/admin { action: "unban", name }                 -> { ok }
 *
 * Helpers are duplicated from leaderboard.ts on purpose: each file in /api is
 * bundled as its own function, and keeping them standalone avoids module
 * resolution surprises.
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

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const KV_URL = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_PASSWORD = env.ADMIN_PASSWORD ?? "";

const WIB_OFFSET_MS = 7 * 3600 * 1000;
const BANNED_KEY = "hk:banned";
const LOG_KEY = "hk:log";
const MAX_FAILS = 10; // wrong passwords per IP per 15 minutes

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

function boardKey(period: Period, now = Date.now()): string {
  if (period === "all") return "hk:v2:all";
  const d = new Date(now + WIB_OFFSET_MS);
  if (period === "day") return `hk:v2:d:${d.toISOString().slice(0, 10)}`;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `hk:v2:w:${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function header(req: Req, name: string): string {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function q(req: Req, key: string): string | undefined {
  const v = req.query?.[key];
  return Array.isArray(v) ? v[0] : v;
}

function clientIp(req: Req): string {
  return header(req, "x-forwarded-for").split(",")[0].trim() || "unknown";
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  }
  return diff === 0;
}

const validName = (n: unknown): n is string => typeof n === "string" && /^[A-Z]{4}$/.test(n);

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");

  if (!KV_URL || !KV_TOKEN) {
    res.status(503).json({ error: "not_configured" });
    return;
  }
  if (ADMIN_PASSWORD.length < 8) {
    res.status(503).json({ error: "admin_not_configured" });
    return;
  }

  try {
    // ---- auth with brute-force lockout
    const ip = clientIp(req);
    const failKey = `hk:adm:fail:${ip}`;
    const [fails] = await kv([["GET", failKey]]);
    if (Number(fails) >= MAX_FAILS) {
      res.status(429).json({ error: "locked" });
      return;
    }
    if (!safeEqual(header(req, "x-admin-key"), ADMIN_PASSWORD)) {
      await kv([
        ["SET", failKey, 0, "EX", 900, "NX"],
        ["INCR", failKey],
      ]);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const period = (PERIODS as string[]).includes(q(req, "period") ?? "") ? (q(req, "period") as Period) : "week";
      const search = (q(req, "q") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
      const limit = Math.min(Math.max(Number(q(req, "limit")) || 200, 1), 500);
      const key = boardKey(period);
      const out = await kv([
        ["ZREVRANGE", key, 0, search ? 4999 : limit - 1, "WITHSCORES"],
        ["ZCARD", boardKey("day")],
        ["ZCARD", boardKey("week")],
        ["ZCARD", boardKey("all")],
        ["SMEMBERS", BANNED_KEY],
        ["LRANGE", LOG_KEY, 0, 149],
      ]);
      const flat = (out[0] as string[]) ?? [];
      let entries: Array<{ rank: number; name: string; score: number }> = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        entries.push({ rank: i / 2 + 1, name: flat[i], score: Number(flat[i + 1]) / 100 });
      }
      if (search) entries = entries.filter((e) => e.name.startsWith(search)).slice(0, limit);
      const log = ((out[5] as string[]) ?? []).flatMap((raw) => {
        try {
          return [JSON.parse(raw) as { n: string; s: number; t: number; r: number; ip: string }];
        } catch {
          return [];
        }
      });
      const totals = { day: Number(out[1]), week: Number(out[2]), all: Number(out[3]) };
      res.status(200).json({
        period,
        boardKeys: { day: boardKey("day"), week: boardKey("week"), all: boardKey("all") },
        summary: { ...totals, banned: ((out[4] as string[]) ?? []).length },
        total: totals[period],
        entries,
        banned: ((out[4] as string[]) ?? []).sort(),
        log,
      });
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
      const name = typeof b.name === "string" ? b.name.toUpperCase() : "";

      switch (b.action) {
        case "login":
          res.status(200).json({ ok: true });
          return;
        case "delete": {
          if (!validName(name)) break;
          const periods = (Array.isArray(b.periods) ? b.periods : PERIODS).filter((p): p is Period =>
            (PERIODS as unknown[]).includes(p),
          );
          await kv(periods.map((p) => ["ZREM", boardKey(p), name]));
          res.status(200).json({ ok: true });
          return;
        }
        case "ban": {
          if (!validName(name)) break;
          await kv([["SADD", BANNED_KEY, name], ...PERIODS.map((p) => ["ZREM", boardKey(p), name])]);
          res.status(200).json({ ok: true });
          return;
        }
        case "unban": {
          if (!validName(name)) break;
          await kv([["SREM", BANNED_KEY, name]]);
          res.status(200).json({ ok: true });
          return;
        }
      }
      res.status(400).json({ error: "bad_request" });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: "server_error", detail: String((e as Error).message ?? e) });
  }
}
