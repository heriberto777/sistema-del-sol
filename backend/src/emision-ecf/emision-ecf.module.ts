import { Module } from '@nestjs/common';
import { AlanubeAdapter } from './alanube.adapter';

@Module({
  providers: [AlanubeAdapter],
  exports: [AlanubeAdapter],
})
export class EmisionECfModule {}
