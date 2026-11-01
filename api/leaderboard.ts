/**
 * Hujan Kalori leaderboard — Vercel serverless function backed by Vercel KV
 * (Upstash Redis). Talks to the Upstash REST API with plain fetch, so there
 * are no runtime dependencies.
 *
 *   GET  /api/leaderboard?limit=20   -> { entries: Entry[] }
 *   POST /api/leaderboard {name, score} -> { rank, id, entries }
 *
 * Env (added automatically when a KV / Upstash Redis store is connected to the
 * Vercel project): KV_REST_API_URL + KV_REST_API_TOKEN
 * (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
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

interface Entry {
  rank: number;
  name: string;
  score: number;
  id: string;
}

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const KV_URL = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;

const BOARD = "hk:lb";
const KEEP = 500; // entries kept in the sorted set
const MAX_SCORE_SEC = 3600;
const RATE_LIMIT = 6; // submissions per IP per minute

// Initials that are not allowed on the public board (ID + EN).
const BLOCKED = new Set([
  "ANJG", "ANJR", "ANJN", "ANJI", "BABI", "BGST", "BNGS", "BANG", "TAIK", "TAII", "KONT", "KNTL",
  "MEMK", "MMEK", "JEMB", "JMBT", "PEPE", "PUKI", "LONT", "COLI", "NGEW", "NGNT", "TOLO", "GOBL",
  "BEGO", "ASUU", "PERE", "FUCK", "FUKK", "SHIT", "CUNT", "DICK", "COCK", "PUSS", "SLUT", "WHOR",
  "NIGG", "NIGA", "FAGG", "RAPE", "PORN", "SEXX", "SEKS", "TITS", "BOOB", "ANAL", "PENS", "VAGN",
]);

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

function parseRange(flat: unknown, offset = 0): Entry[] {
  const arr = Array.isArray(flat) ? (flat as string[]) : [];
  const entries: Entry[] = [];
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const [name, id = ""] = String(arr[i]).split(":");
    entries.push({ rank: offset + entries.length + 1, name, id, score: Number(arr[i + 1]) / 100 });
  }
  return entries;
}

function clientIp(req: Req): string {
  const fwd = req.headers["x-forwarded-for"];
  const v = Array.isArray(fwd) ? fwd[0] : fwd;
  return (v ?? "unknown").split(",")[0].trim();
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (!KV_URL || !KV_TOKEN) {
    res.status(503).json({ error: "not_configured" });
    return;
  }

  try {
    if (req.method === "GET") {
      const raw = Array.isArray(req.query?.limit) ? req.query?.limit[0] : req.query?.limit;
      const limit = Math.min(Math.max(Number(raw) || 20, 1), 50);
      const [range] = await kv([["ZREVRANGE", BOARD, 0, limit - 1, "WITHSCORES"]]);
      res.status(200).json({ entries: parseRange(range) });
      return;
    }

    if (req.method === "POST") {
      let body = req.body as { name?: unknown; score?: unknown } | string | undefined;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body) as { name?: unknown; score?: unknown };
        } catch {
          body = undefined;
        }
      }
      const name = String((body as { name?: unknown })?.name ?? "").toUpperCase();
      const score = Number((body as { score?: unknown })?.score);

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

      const rl = `hk:rl:${clientIp(req)}`;
      const [, count] = await kv([
        ["SET", rl, 0, "EX", 60, "NX"],
        ["INCR", rl],
      ]);
      if (Number(count) > RATE_LIMIT) {
        res.status(429).json({ error: "rate_limited" });
        return;
      }

      const id = Math.random().toString(36).slice(2, 10);
      const member = `${name}:${id}`;
      const cs = Math.round(score * 100);
      const [, rank, range] = await kv([
        ["ZADD", BOARD, cs, member],
        ["ZREVRANK", BOARD, member],
        ["ZREVRANGE", BOARD, 0, 9, "WITHSCORES"],
        ["ZREMRANGEBYRANK", BOARD, 0, -(KEEP + 1)],
      ]);

      res.status(200).json({ id, rank: Number(rank) + 1, entries: parseRange(range) });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: "server_error", detail: String((e as Error).message ?? e) });
  }
}
