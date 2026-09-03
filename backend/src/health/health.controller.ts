import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

/** Liveness check para el healthcheck del contenedor en producción (ver docker-compose.prod.yml). */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  ping() {
    return { status: 'ok' };
  }
}
