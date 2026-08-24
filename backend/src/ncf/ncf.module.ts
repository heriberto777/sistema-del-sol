import { Module } from '@nestjs/common';
import { SucursalesModule } from '../sucursales/sucursales.module';
import { NcfService } from './ncf.service';
import { NcfController } from './ncf.controller';
import { NcfRepository } from './ncf.repository';

@Module({
  imports: [SucursalesModule],
  controllers: [NcfController],
  providers: [NcfService, NcfRepository],
})
export class NcfModule {}
