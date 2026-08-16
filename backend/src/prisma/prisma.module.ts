import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppPrismaService } from './app-prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';

@Global()
@Module({
  providers: [PrismaService, AppPrismaService, TenantPrismaService],
  exports: [PrismaService, AppPrismaService, TenantPrismaService],
})
export class PrismaModule {}
