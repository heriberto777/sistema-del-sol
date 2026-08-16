import { RedisThrottlerStorage } from './redis-throttler-storage.service';
import { RedisService } from './redis.service';

/**
 * Reimplementación en memoria del script Lua de incremento, con la misma
 * semántica (bloqueo, TTL, conteo), para poder probar RedisThrottlerStorage
 * sin depender de una instancia real de Redis.
 */
function crearEvalFalso() {
  const hits = new Map<string, number>();
  const hitsExpiraEn = new Map<string, number>();
  const blockExpiraEn = new Map<string, number>();

  return jest.fn(async (_script: string, _numKeys: number, hitsKey: string, blockKey: string, ttlMs: number, limit: number, blockDurationMs: number) => {
    const ahora = Date.now();
    const blockTtl = (blockExpiraEn.get(blockKey) ?? 0) - ahora;
    if (blockTtl > 0) {
      const hitsTtl = Math.max(0, (hitsExpiraEn.get(hitsKey) ?? 0) - ahora);
      return [hits.get(hitsKey) ?? 0, hitsTtl, 1, blockTtl];
    }

    const nuevoHit = (hits.get(hitsKey) ?? 0) + 1;
    hits.set(hitsKey, nuevoHit);
    if (nuevoHit === 1) hitsExpiraEn.set(hitsKey, ahora + ttlMs);
    const hitsTtl = Math.max(0, (hitsExpiraEn.get(hitsKey) ?? 0) - ahora);

    let isBlocked = 0;
    let blockTtlOut = 0;
    if (nuevoHit > limit) {
      blockExpiraEn.set(blockKey, ahora + blockDurationMs);
      isBlocked = 1;
      blockTtlOut = blockDurationMs;
    }

    return [nuevoHit, hitsTtl, isBlocked, blockTtlOut];
  });
}

describe('RedisThrottlerStorage', () => {
  let redis: jest.Mocked<RedisService>;
  let evalFalso: ReturnType<typeof crearEvalFalso>;
  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    evalFalso = crearEvalFalso();
    redis = { client: { eval: evalFalso } } as unknown as jest.Mocked<RedisService>;
    storage = new RedisThrottlerStorage(redis);
  });

  it('cuenta los hits y no bloquea mientras esté por debajo del límite', async () => {
    const r1 = await storage.increment('ip-1', 60_000, 3, 60_000, 'default');
    const r2 = await storage.increment('ip-1', 60_000, 3, 60_000, 'default');

    expect(r1.totalHits).toBe(1);
    expect(r2.totalHits).toBe(2);
    expect(r1.isBlocked).toBe(false);
    expect(r2.isBlocked).toBe(false);
  });

  it('bloquea al superar el límite', async () => {
    await storage.increment('ip-2', 60_000, 2, 30_000, 'default');
    await storage.increment('ip-2', 60_000, 2, 30_000, 'default');
    const tercero = await storage.increment('ip-2', 60_000, 2, 30_000, 'default');

    expect(tercero.totalHits).toBe(3);
    expect(tercero.isBlocked).toBe(true);
    expect(tercero.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('mantiene el bloqueo (sin seguir incrementando) mientras el bloqueo esté vigente', async () => {
    await storage.increment('ip-3', 60_000, 1, 30_000, 'default');
    const bloqueado1 = await storage.increment('ip-3', 60_000, 1, 30_000, 'default');
    const bloqueado2 = await storage.increment('ip-3', 60_000, 1, 30_000, 'default');

    expect(bloqueado1.isBlocked).toBe(true);
    expect(bloqueado2.isBlocked).toBe(true);
    expect(bloqueado1.totalHits).toBe(bloqueado2.totalHits);
  });

  it('aísla contadores por throttlerName y por key aunque el key base sea el mismo', async () => {
    await storage.increment('mismo-ip', 60_000, 1, 30_000, 'login');
    const otroThrottler = await storage.increment('mismo-ip', 60_000, 5, 30_000, 'default');

    expect(otroThrottler.totalHits).toBe(1);
    expect(otroThrottler.isBlocked).toBe(false);
  });

  it('convierte los TTL de milisegundos (Redis) a segundos (contrato de ThrottlerStorage)', async () => {
    const resultado = await storage.increment('ip-4', 60_000, 5, 30_000, 'default');

    expect(resultado.timeToExpire).toBe(60);
  });
});
