import { Module } from '@nestjs/common';
import { LeyesFiscalesService } from './leyes-fiscales.service';
import { LeyesFiscalesController } from './leyes-fiscales.controller';
import { LeyesFiscalesRepository } from './leyes-fiscales.repository';

@Module({
  controllers: [LeyesFiscalesController],
  providers: [LeyesFiscalesService, LeyesFiscalesRepository],
  exports: [LeyesFiscalesService, LeyesFiscalesRepository],
})
export class LeyesFiscalesModule {}
