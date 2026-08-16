import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from './redis.service';

/**
 * Atómico vía Lua: evita condiciones de carrera cuando hay varias instancias
 * del API compartiendo el mismo contador de rate-limit en Redis.
 */
const SCRIPT_INCREMENTAR = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttlMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDurationMs = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', hitsKey) or '0')
  local hitsTtl = redis.call('PTTL', hitsKey)
  if hitsTtl < 0 then hitsTtl = 0 end
  return {hits, hitsTtl, 1, blockTtl}
end

local hits = redis.call('INCR', hitsKey)
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttlMs)
end
local hitsTtl = redis.call('PTTL', hitsKey)
if hitsTtl < 0 then hitsTtl = 0 end

local isBlocked = 0
local blockTtlOut = 0
if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDurationMs)
  isBlocked = 1
  blockTtlOut = blockDurationMs
end

return {hits, hitsTtl, isBlocked, blockTtlOut}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const prefijo = `throttler:${throttlerName}:${key}`;
    const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] = (await this.redis.client.eval(
      SCRIPT_INCREMENTAR,
      2,
      `${prefijo}:hits`,
      `${prefijo}:block`,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpireMs / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
    };
  }
}
