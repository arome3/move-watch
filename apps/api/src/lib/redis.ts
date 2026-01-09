import { Redis } from '@upstash/redis';

// Create Redis client from environment variables
// Upstash REST API uses URL + TOKEN authentication
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Fall back to local Redis URL for development
const localRedisUrl = process.env.REDIS_URL;

// Create the appropriate Redis client
let redis: Redis;

if (upstashUrl && upstashToken) {
  // Use Upstash REST client
  redis = new Redis({
    url: upstashUrl,
    token: upstashToken,
  });
  console.log('Using Upstash Redis REST API');
} else if (localRedisUrl) {
  console.warn('UPSTASH_REDIS_REST_URL not set, using mock Redis for development');
  redis = createMockRedis();
} else {
  console.warn('No Redis configuration found, using mock Redis');
  redis = createMockRedis();
}

// In-memory mock Redis for local development
// Implements the subset of commands used by the application
function createMockRedis(): Redis {
  const store = new Map<string, { value: string; expireAt?: number }>();
  const lists = new Map<string, string[]>();

  const isExpired = (key: string): boolean => {
    const item = store.get(key);
    if (item?.expireAt && Date.now() > item.expireAt) {
      store.delete(key);
      return true;
    }
    return false;
  };

  return {
    // String operations
    get: async (key: string) => {
      if (isExpired(key)) return null;
      const item = store.get(key);
      if (!item) return null;
      try {
        return JSON.parse(item.value);
      } catch {
        return item.value;
      }
    },

    set: async (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => {
      // NX: Only set if key does not exist
      if (opts?.nx && store.has(key)) {
        const existing = store.get(key);
        // Check if expired
        if (existing?.expireAt && Date.now() > existing.expireAt) {
          store.delete(key);
        } else {
          return null; // Key exists, don't set
        }
      }
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      store.set(key, {
        value: stringValue,
        expireAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
      });
      return 'OK';
    },

    setex: async (key: string, seconds: number, value: unknown) => {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      store.set(key, {
        value: stringValue,
        expireAt: Date.now() + seconds * 1000,
      });
      return 'OK';
    },

    incr: async (key: string) => {
      if (isExpired(key)) {
        store.set(key, { value: '1' });
        return 1;
      }
      const item = store.get(key);
      const current = item ? parseInt(item.value, 10) || 0 : 0;
      const newValue = current + 1;
      store.set(key, {
        value: String(newValue),
        expireAt: item?.expireAt,
      });
      return newValue;
    },

    expire: async (key: string, seconds: number) => {
      const item = store.get(key);
      if (item) {
        item.expireAt = Date.now() + seconds * 1000;
        return 1;
      }
      return 0;
    },

    ttl: async (key: string) => {
      const item = store.get(key);
      if (!item) return -2; // Key does not exist
      if (!item.expireAt) return -1; // Key exists but has no expiry
      const ttl = Math.floor((item.expireAt - Date.now()) / 1000);
      return ttl > 0 ? ttl : -2; // Expired
    },

    del: async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.has(key)) {
          store.delete(key);
          deleted++;
        }
        if (lists.has(key)) {
          lists.delete(key);
          deleted++;
        }
      }
      return deleted;
    },

    // List operations
    lpush: async (key: string, ...values: unknown[]) => {
      let list = lists.get(key) || [];
      const stringValues = values.map((v) =>
        typeof v === 'string' ? v : JSON.stringify(v)
      );
      list = [...stringValues.reverse(), ...list];
      lists.set(key, list);
      return list.length;
    },

    rpush: async (key: string, ...values: unknown[]) => {
      const list = lists.get(key) || [];
      const stringValues = values.map((v) =>
        typeof v === 'string' ? v : JSON.stringify(v)
      );
      list.push(...stringValues);
      lists.set(key, list);
      return list.length;
    },

    llen: async (key: string) => {
      const list = lists.get(key);
      return list ? list.length : 0;
    },

    lrange: async (key: string, start: number, stop: number) => {
      const list = lists.get(key) || [];
      // Handle negative indices
      const len = list.length;
      const actualStart = start < 0 ? Math.max(0, len + start) : start;
      const actualStop = stop < 0 ? len + stop : stop;
      return list.slice(actualStart, actualStop + 1).map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    },

    lrem: async (key: string, count: number, value: unknown) => {
      const list = lists.get(key);
      if (!list) return 0;
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      let removed = 0;
      const absCount = Math.abs(count);
      const direction = count >= 0 ? 1 : -1;

      const indices: number[] = [];
      for (let i = direction === 1 ? 0 : list.length - 1;
           direction === 1 ? i < list.length : i >= 0;
           i += direction) {
        if (list[i] === stringValue) {
          indices.push(i);
          removed++;
          if (count !== 0 && removed >= absCount) break;
        }
      }

      // Remove in reverse order to maintain indices
      indices.sort((a, b) => b - a);
      for (const idx of indices) {
        list.splice(idx, 1);
      }

      lists.set(key, list);
      return removed;
    },

    // LMOVE: atomically move element between lists
    lmove: async (
      source: string,
      destination: string,
      whereFrom: 'left' | 'right',
      whereTo: 'left' | 'right'
    ) => {
      const sourceList = lists.get(source);
      if (!sourceList || sourceList.length === 0) return null;

      // Pop from source
      const value = whereFrom === 'left' ? sourceList.shift()! : sourceList.pop()!;
      lists.set(source, sourceList);

      // Push to destination
      const destList = lists.get(destination) || [];
      if (whereTo === 'left') {
        destList.unshift(value);
      } else {
        destList.push(value);
      }
      lists.set(destination, destList);

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    },

    // Pipeline support (executes immediately in mock)
    pipeline: () => {
      const commands: Array<{ method: string; args: unknown[] }> = [];
      const pipelineObj = {
        get: (key: string) => {
          commands.push({ method: 'get', args: [key] });
          return pipelineObj;
        },
        set: (key: string, value: unknown, opts?: { ex?: number }) => {
          commands.push({ method: 'set', args: [key, value, opts] });
          return pipelineObj;
        },
        setex: (key: string, seconds: number, value: unknown) => {
          commands.push({ method: 'setex', args: [key, seconds, value] });
          return pipelineObj;
        },
        del: (...keys: string[]) => {
          commands.push({ method: 'del', args: keys });
          return pipelineObj;
        },
        llen: (key: string) => {
          commands.push({ method: 'llen', args: [key] });
          return pipelineObj;
        },
        rpush: (key: string, ...values: unknown[]) => {
          commands.push({ method: 'rpush', args: [key, ...values] });
          return pipelineObj;
        },
        lpush: (key: string, ...values: unknown[]) => {
          commands.push({ method: 'lpush', args: [key, ...values] });
          return pipelineObj;
        },
        lrem: (key: string, count: number, value: unknown) => {
          commands.push({ method: 'lrem', args: [key, count, value] });
          return pipelineObj;
        },
        exec: async () => {
          const mockRedis = createMockRedis();
          const results: unknown[] = [];
          for (const cmd of commands) {
            const fn = (mockRedis as unknown as Record<string, Function>)[cmd.method];
            if (fn) {
              results.push(await fn.apply(mockRedis, cmd.args));
            } else {
              results.push(null);
            }
          }
          return results;
        },
      };
      return pipelineObj;
    },

    ping: async () => 'PONG',
  } as unknown as Redis;
}

export { redis };

/**
 * Cache a value with TTL
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
}

/**
 * Get a cached value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  if (!cached) return null;
  // Upstash REST client auto-parses JSON
  if (typeof cached === 'string') {
    try {
      return JSON.parse(cached) as T;
    } catch {
      return cached as unknown as T;
    }
  }
  return cached as T;
}

/**
 * Check rate limit for a key
 * Returns true if within limit, false if exceeded
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await redis.incr(key);

  if (current === 1) {
    // First request, set expiry
    await redis.expire(key, windowSeconds);
  }

  const remaining = Math.max(0, limit - current);
  return {
    allowed: current <= limit,
    remaining,
  };
}

/**
 * Check if Redis is connected (for health checks)
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
