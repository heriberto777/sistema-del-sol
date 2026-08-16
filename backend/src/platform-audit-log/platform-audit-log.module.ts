import { Module } from '@nestjs/common';
import { PlatformAuditLogController } from './platform-audit-log.controller';

@Module({
  controllers: [PlatformAuditLogController],
})
export class PlatformAuditLogModule {}
