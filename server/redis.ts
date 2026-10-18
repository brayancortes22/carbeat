// Cliente Redis mínimo: una lista de comandos entra, una lista de resultados sale.
// Upstash en producción (REST /pipeline) y una implementación en memoria para desarrollo y
// tests. El relé usa exactamente los mismos comandos con las dos, así que lo que se prueba en
// local es lo que corre en Vercel.

export type Cmd = (string | number)[];

export interface RedisLike {
  readonly kind: 'upstash' | 'memory';
  /** Ejecuta en una sola petición. Un comando fallido devuelve un Error en su posición. */
  exec(cmds: Cmd[]): Promise<unknown[]>;
}

export class UpstashRedis implements RedisLike {
  readonly kind = 'upstash' as const;
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async exec(cmds: Cmd[]): Promise<unknown[]> {
    if (cmds.length === 0) return [];
    // Formato documentado: POST <url>/pipeline con [[CMD, ...args], ...] y
    // respuesta [{ result } | { error }, ...] en el mismo orden. No es atómico.
    const res = await fetch(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok && res.status !== 400) throw new Error(`Upstash HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      const msg = (data as { error?: string })?.error ?? 'respuesta inesperada';
      throw new Error(`Upstash: ${msg}`);
    }
    return data.map((item: { result?: unknown; error?: string }) => (item && 'error' in item && item.error ? new Error(item.error) : item?.result ?? null));
  }
}

// ------------------------------------------------------------------ en memoria

type Entry =
  | { type: 'string'; value: string; expiresAt: number | null }
  | { type: 'list'; value: string[]; expiresAt: number | null }
  | { type: 'zset'; value: Map<string, number>; expiresAt: number | null };

/**
 * Subconjunto de Redis con la semántica que usa el relé (SET NX EX, LPOP con count, ZSET...).
 * Cuenta los comandos ejecutados: así se puede estimar el gasto contra el plan de Upstash.
 */
export class MemoryRedis implements RedisLike {
  readonly kind = 'memory' as const;
  private store = new Map<string, Entry>();
  commandCount = 0;
  requestCount = 0;

  constructor(private readonly clock: () => number = Date.now) {}

  private live(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt !== null && e.expiresAt <= this.clock()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async exec(cmds: Cmd[]): Promise<unknown[]> {
    this.requestCount++;
    return cmds.map((c) => {
      this.commandCount++;
      try {
        return this.run(c.map(String));
      } catch (err) {
        return err instanceof Error ? err : new Error(String(err));
      }
    });
  }

  private run([rawName, ...args]: string[]): unknown {
    const name = rawName.toUpperCase();
    const now = this.clock();
    switch (name) {
      case 'GET': {
        const e = this.live(args[0]);
        if (!e) return null;
        if (e.type !== 'string') throw new Error('WRONGTYPE');
        return e.value;
      }
      case 'MGET':
        return args.map((k) => {
          const e = this.live(k);
          return e && e.type === 'string' ? e.value : null;
        });
      case 'SET': {
        const [key, value, ...opts] = args;
        let nx = false;
        let ex: number | null = null;
        for (let i = 0; i < opts.length; i++) {
          const o = opts[i].toUpperCase();
          if (o === 'NX') nx = true;
          else if (o === 'EX') ex = Number(opts[++i]);
        }
        if (nx && this.live(key)) return null;
        this.store.set(key, { type: 'string', value, expiresAt: ex ? now + ex * 1000 : null });
        return 'OK';
      }
      case 'DEL': {
        let n = 0;
        for (const k of args) if (this.live(k) && this.store.delete(k)) n++;
        return n;
      }
      case 'EXISTS':
        return args.filter((k) => this.live(k)).length;
      case 'EXPIRE': {
        const e = this.live(args[0]);
        if (!e) return 0;
        e.expiresAt = now + Number(args[1]) * 1000;
        return 1;
      }
      case 'RPUSH': {
        const [key, ...vals] = args;
        let e = this.live(key);
        if (!e) {
          e = { type: 'list', value: [], expiresAt: null };
          this.store.set(key, e);
        }
        if (e.type !== 'list') throw new Error('WRONGTYPE');
        e.value.push(...vals);
        return e.value.length;
      }
      case 'LTRIM': {
        const e = this.live(args[0]);
        if (!e) return 'OK';
        if (e.type !== 'list') throw new Error('WRONGTYPE');
        const len = e.value.length;
        let start = Number(args[1]);
        let stop = Number(args[2]);
        if (start < 0) start = Math.max(0, len + start);
        if (stop < 0) stop = len + stop;
        e.value = e.value.slice(start, stop + 1);
        if (!e.value.length) this.store.delete(args[0]);
        return 'OK';
      }
      case 'LPOP': {
        const e = this.live(args[0]);
        const count = args[1] !== undefined ? Number(args[1]) : null;
        if (!e) return null;
        if (e.type !== 'list') throw new Error('WRONGTYPE');
        const out = e.value.splice(0, count ?? 1);
        if (!e.value.length) this.store.delete(args[0]);
        return count === null ? (out[0] ?? null) : out;
      }
      case 'LLEN': {
        const e = this.live(args[0]);
        return e && e.type === 'list' ? e.value.length : 0;
      }
      case 'ZADD': {
        const [key, ...pairs] = args;
        let e = this.live(key);
        if (!e) {
          e = { type: 'zset', value: new Map(), expiresAt: null };
          this.store.set(key, e);
        }
        if (e.type !== 'zset') throw new Error('WRONGTYPE');
        let added = 0;
        for (let i = 0; i < pairs.length; i += 2) {
          if (!e.value.has(pairs[i + 1])) added++;
          e.value.set(pairs[i + 1], Number(pairs[i]));
        }
        return added;
      }
      case 'ZREM': {
        const e = this.live(args[0]);
        if (!e || e.type !== 'zset') return 0;
        let n = 0;
        for (const m of args.slice(1)) if (e.value.delete(m)) n++;
        return n;
      }
      case 'ZRANGEBYSCORE':
      case 'ZREMRANGEBYSCORE': {
        const e = this.live(args[0]);
        const parse = (v: string) => (v === '-inf' ? -Infinity : v === '+inf' ? Infinity : Number(v));
        const min = parse(args[1]);
        const max = parse(args[2]);
        if (!e || e.type !== 'zset') return name === 'ZRANGEBYSCORE' ? [] : 0;
        const hits = [...e.value.entries()].filter(([, s]) => s >= min && s <= max).sort((a, b) => a[1] - b[1]);
        if (name === 'ZRANGEBYSCORE') return hits.map(([m]) => m);
        for (const [m] of hits) e.value.delete(m);
        return hits.length;
      }
      default:
        throw new Error(`ERR comando no soportado en memoria: ${name}`);
    }
  }
}

let shared: RedisLike | null = null;

/** Upstash si hay credenciales; si no, memoria (sólo vale para una instancia: desarrollo). */
export function redisFromEnv(env: Record<string, string | undefined> = process.env): RedisLike {
  if (shared) return shared;
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  shared = url && token ? new UpstashRedis(url, token) : new MemoryRedis();
  return shared;
}
