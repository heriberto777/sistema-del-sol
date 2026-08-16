import { Module } from '@nestjs/common';
import { NcfService } from './ncf.service';
import { NcfController } from './ncf.controller';
import { NcfRepository } from './ncf.repository';

@Module({
  controllers: [NcfController],
  providers: [NcfService, NcfRepository],
})
export class NcfModule {}
