import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';
import { ListarErroresQueryDto } from './dto/listar-errores-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';

/**
 * `auditoria.ver` ya existía en PERMISOS_BASE (rol "Auditor") sin ningún
 * endpoint que lo consumiera — AuditLog se graba solo desde hace tiempo vía
 * AuditLogInterceptor (global), esto solo lo expone. No lleva
 * `@RequiereModulo`: es plomería de administración, igual que Usuarios/Roles,
 * no un módulo de plan.
 */
@ApiBearerAuth()
@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Permissions('auditoria.ver')
  listarActividad(@Query() query: ListarAuditoriaQueryDto) {
    return this.auditoriaService.listarActividad(query);
  }

  @Get('usuarios')
  @Permissions('auditoria.ver')
  listarUsuariosConActividad() {
    return this.auditoriaService.listarUsuariosConActividad();
  }

  @Get('errores')
  @Permissions('auditoria.ver')
  listarErrores(@Query() query: ListarErroresQueryDto) {
    return this.auditoriaService.listarErrores(query);
  }
}
