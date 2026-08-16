import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      lazyConnect: false,
    });
  }

  async obtenerJson<T>(clave: string): Promise<T | null> {
    const valor = await this.client.get(clave);
    return valor ? (JSON.parse(valor) as T) : null;
  }

  async guardarJson(clave: string, valor: unknown, ttlSegundos: number): Promise<void> {
    await this.client.set(clave, JSON.stringify(valor), 'EX', ttlSegundos);
  }

  async eliminar(clave: string): Promise<void> {
    await this.client.del(clave);
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
