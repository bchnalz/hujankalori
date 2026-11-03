/**
 * Hujan Kalori — admin API for moderating the leaderboard.
 * Protected by the ADMIN_PASSWORD env var (set it in Vercel → Settings →
 * Environment Variables). Requests send it in the `x-admin-key` header.
 *
 *   GET  /api/admin?period=day|week|all&limit=200&q=AB
 *        -> { summary, period, entries, total, banned, log }
 *   GET  /api/admin?view=insights&from=YYYY-MM-DD&to=YYYY-MM-DD
 *        -> run statistics for that WIB date range (locations, play time,
 *           how runs end, items caught, per-day series)
 *   GET  /api/admin?view=export&type=runs|board&from=…&to=…   -> text/csv
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
const MAX_FAILS = 10;
const STATS_DAYS = 14;

function wibDate(now = Date.now()): string {
  return new Date(now + WIB_OFFSET_MS).toISOString().slice(0, 10);
} // wrong passwords per IP per 15 minutes

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

const RUNS_KEY = "hk:runs";
const MAX_RANGE_DAYS = 400;
const EXPORT_MAX = 50000;

/** WIB date range from the query (defaults: last 30 days), clamped. */
function dateRange(req: Req): { from: string; to: string; days: string[]; fromMs: number; toMs: number } {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = wibDate();
  let to = re.test(q(req, "to") ?? "") ? (q(req, "to") as string) : today;
  if (to > today) to = today;
  let from = re.test(q(req, "from") ?? "") ? (q(req, "from") as string) : wibDate(Date.now() - 29 * 86400000);
  if (from > to) from = to;
  const fromMs = Date.parse(`${from}T00:00:00+07:00`);
  let toMs = Date.parse(`${to}T23:59:59.999+07:00`);
  const span = Math.round((toMs - fromMs) / 86400000);
  if (span > MAX_RANGE_DAYS) {
    toMs = fromMs + MAX_RANGE_DAYS * 86400000 - 1;
    to = wibDate(toMs);
  }
  const days: string[] = [];
  for (let t = fromMs; t <= toMs; t += 86400000) days.push(wibDate(t));
  return { from, to, days, fromMs, toMs };
}

/** HGETALL flat array -> object. */
function hash(flat: unknown): Record<string, string> {
  const a = (flat as string[]) ?? [];
  const o: Record<string, string> = {};
  for (let i = 0; i + 1 < a.length; i += 2) o[a[i]] = a[i + 1];
  return o;
}

function addInto(target: Record<string, number>, src: Record<string, string>): void {
  for (const [k, v] of Object.entries(src)) target[k] = (target[k] ?? 0) + (Number(v) || 0);
}

async function insights(req: Req): Promise<unknown> {
  const { from, to, days } = dateRange(req);
  const H = ["loc", "why", "ch", "g", "u", "items"];
  const cmds: (string | number)[][] = [];
  for (const d of days) {
    cmds.push(["GET", `hk:stats:runs:${d}`], ["GET", `hk:stats:dur:${d}`], ["GET", `hk:stats:plays:${d}`], ["GET", `hk:stats:submits:${d}`]);
    for (const h of H) cmds.push(["HGETALL", `hk:stats:${h}:${d}`]);
  }
  const out: unknown[] = [];
  for (let i = 0; i < cmds.length; i += 600) out.push(...(await kv(cmds.slice(i, i + 600))));
  const per = 4 + H.length;
  const tot: Record<string, Record<string, number>> = Object.fromEntries(H.map((h) => [h, {}]));
  let runs = 0;
  let dur = 0;
  let plays = 0;
  let submits = 0;
  const series = days.map((date, i) => {
    const o = i * per;
    const r = Number(out[o] ?? 0) || 0;
    const du = Number(out[o + 1] ?? 0) || 0;
    const p = Number(out[o + 2] ?? 0) || 0;
    const s = Number(out[o + 3] ?? 0) || 0;
    runs += r;
    dur += du;
    plays += p;
    submits += s;
    H.forEach((h, k) => addInto(tot[h], hash(out[o + 4 + k])));
    return { date, runs: r, plays: p, submits: s, avgSec: r ? Math.round((du / r) * 10) / 10 : 0 };
  });
  const items = Object.entries(tot.items)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));
  return {
    from,
    to,
    runs,
    plays,
    submits,
    avgSec: runs ? Math.round((dur / runs) * 10) / 10 : 0,
    totalSec: Math.round(dur),
    loc: tot.loc,
    why: tot.why,
    ch: tot.ch,
    g: tot.g,
    u: tot.u,
    items,
    series,
  };
}

const csvCell = (v: unknown): string => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Semicolon-separated with a BOM and decimal commas: opens cleanly in Excel (id-ID). */
function toCsv(rows: unknown[][]): string {
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
const dec = (n: unknown): string => (n === "" || n === undefined || n === null ? "" : String(n).replace(".", ","));
const LOC_NAME: Record<string, string> = { hospital: "IGD", morning: "GPT", garden: "Taman (versi 2015)", city: "Kota" };
const ITEM_NAME: Record<string, string> = {
  food_bakso: "Bakso", food_seblak: "Seblak", food_mie_goreng: "Mie Goreng", food_nasi_padang: "Nasi Padang",
  food_donat: "Donat", food_es_teh: "Es Teh", healthy_pisang: "Pisang", healthy_alpukat: "Alpukat",
  healthy_brokoli_rebus: "Brokoli Rebus", healthy_apel: "Apel", healthy_telur_rebus: "Telur Rebus",
  healthy_wortel: "Wortel", healthy_air_mineral: "Air Mineral", activity_jogging_5: "Jogging 5 mnt",
  activity_jogging_30: "Jogging 30 mnt", activity_angkat_beban_15: "Angkat Beban 15 mnt",
  activity_yoga_30: "Yoga 30 mnt", activity_bersepeda_15: "Bersepeda 15 mnt", activity_bersepeda_45: "Bersepeda 45 mnt",
};
const WHY_NAME: Record<string, string> = { hp: "Kekenyangan", starve: "Kelaparan" };

async function exportCsv(req: Req): Promise<{ name: string; body: string }> {
  const { from, to, fromMs, toMs } = dateRange(req);
  if (q(req, "type") === "board") {
    const [flat] = await kv([["ZREVRANGE", "hk:v2:all", 0, EXPORT_MAX - 1, "WITHSCORES"]]);
    const a = (flat as string[]) ?? [];
    const rows: unknown[][] = [["Peringkat", "Inisial", "Skor terbaik (detik)"]];
    for (let i = 0; i + 1 < a.length; i += 2) rows.push([i / 2 + 1, a[i], dec(Number(a[i + 1]) / 100)]);
    return { name: `hujan-kalori-peringkat-${wibDate()}.csv`, body: toCsv(rows) };
  }
  const [sids] = await kv([["ZRANGEBYSCORE", RUNS_KEY, fromMs, toMs, "LIMIT", 0, EXPORT_MAX]]);
  const list = (sids as string[]) ?? [];
  const recs: Record<string, string>[] = [];
  for (let i = 0; i < list.length; i += 500) {
    const part = await kv(list.slice(i, i + 500).map((sid) => ["HGETALL", `hk:run:${sid}`]));
    for (const h of part) {
      const r = hash(h);
      if (r.t) recs.push(r);
    }
  }
  const rows: unknown[][] = [
    ["Tanggal (WIB)", "Jam (WIB)", "Inisial", "Lama bermain (detik)", "Skor dikirim (detik)", "Berakhir karena", "Lokasi", "Cara pilih lokasi", "Gender", "Seragam", "Kalori dimakan", "Kalori dibakar", "Item ditangkap", "Rincian item"],
  ];
  for (const r of recs) {
    const t = new Date(Number(r.t) + WIB_OFFSET_MS).toISOString();
    let detail = "";
    try {
      detail = Object.entries(JSON.parse(r.items || "{}") as Record<string, number>)
        .map(([k, n]) => `${ITEM_NAME[k] ?? k} x${n}`)
        .join(", ");
    } catch {
      /* ignore */
    }
    rows.push([
      t.slice(0, 10),
      t.slice(11, 19),
      r.name ?? "",
      dec(r.sec),
      dec(r.score ?? ""),
      WHY_NAME[r.why] ?? r.why,
      LOC_NAME[r.loc] ?? r.loc,
      r.ch === "auto" ? "Otomatis" : "Dipilih",
      r.g === "female" ? "Perempuan" : "Laki-laki",
      r.u ?? "",
      r.kin ?? "",
      r.kout ?? "",
      r.caught ?? "",
      detail,
    ]);
  }
  return { name: `hujan-kalori-riwayat-${from}_sd_${to}.csv`, body: toCsv(rows) };
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

    if (req.method === "GET" && q(req, "view") === "insights") {
      res.status(200).json(await insights(req));
      return;
    }
    if (req.method === "GET" && q(req, "view") === "export") {
      const { name, body } = await exportCsv(req);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      (res as unknown as { send?: (b: string) => void; end: (b?: string) => void }).send
        ? (res as unknown as { send: (b: string) => void }).send(body)
        : (res as unknown as { end: (b: string) => void }).end(body);
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

      // Play statistics: totals + the last STATS_DAYS days (WIB).
      const days: string[] = [];
      for (let i = STATS_DAYS - 1; i >= 0; i--) days.push(wibDate(Date.now() - i * 86400000));
      const st = await kv([
        ["MGET", "hk:stats:plays", "hk:stats:submits", ...days.map((d) => `hk:stats:plays:${d}`)],
        ["MGET", ...days.map((d) => `hk:stats:submits:${d}`)],
        ["PFCOUNT", "hk:stats:dev"],
        ...days.map((d) => ["PFCOUNT", `hk:stats:dev:${d}`]),
      ]);
      const n = (v: unknown): number => Number(v ?? 0) || 0;
      const head = (st[0] as unknown[]) ?? [];
      const subs = (st[1] as unknown[]) ?? [];
      const stats = {
        plays: n(head[0]),
        submits: n(head[1]),
        devices: n(st[2]),
        days: days.map((date, i) => ({
          date,
          plays: n(head[2 + i]),
          submits: n(subs[i]),
          devices: n(st[3 + i]),
        })),
      };
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
        stats,
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
