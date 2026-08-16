import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Singleton conectado con el rol restringido de Postgres (APP_DATABASE_URL,
 * ver scripts/setup-app-role.ts) — sin privilegios de superusuario ni
 * BYPASSRLS, sujeto de verdad a las policies de enable-rls.sql.
 *
 * TenantPrismaService (request-scoped) extiende ESTE singleton por request
 * en vez de abrir una PrismaClient nueva por request — extender un client ya
 * conectado no abre conexión nueva, así que esto no agota el pool.
 */
@Injectable()
export class AppPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasourceUrl: process.env.APP_DATABASE_URL });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
