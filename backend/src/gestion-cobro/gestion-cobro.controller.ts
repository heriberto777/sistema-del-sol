import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GestionCobroService } from './gestion-cobro.service';
import { CrearGestionCobroDto } from './dto/crear-gestion-cobro.dto';
import { ProvisionarIncobrableDto } from './dto/provisionar-incobrable.dto';
import { CastigarIncobrableDto } from './dto/castigar-incobrable.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('gestion-cobro')
@RequiereModulo('facturacion')
@Controller('gestion-cobro')
export class GestionCobroController {
  constructor(private readonly gestionCobroService: GestionCobroService) {}

  @Post()
  @Permissions('cuentasporcobrar.gestion.crear')
  crear(@Body() dto: CrearGestionCobroDto, @CurrentUser() user: JwtPayloadUser) {
    return this.gestionCobroService.crearGestion(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('cuentasporcobrar.gestion.ver')
  listar(@Query('facturaId') facturaId: string) {
    return this.gestionCobroService.listarGestiones(facturaId);
  }

  @Get('incobrable')
  @Permissions('cuentasporcobrar.gestion.ver')
  estadoIncobrable(@Query('facturaId') facturaId: string) {
    return this.gestionCobroService.estadoIncobrable(facturaId);
  }

  @Post('incobrable/provisionar')
  @Permissions('cuentasporcobrar.incobrables.gestionar')
  provisionar(@Body() dto: ProvisionarIncobrableDto, @CurrentUser() user: JwtPayloadUser) {
    return this.gestionCobroService.provisionar(dto, user.tenantId, user.userId);
  }

  @Post('incobrable/castigar')
  @Permissions('cuentasporcobrar.incobrables.gestionar')
  castigar(@Body() dto: CastigarIncobrableDto, @CurrentUser() user: JwtPayloadUser) {
    return this.gestionCobroService.castigar(dto, user.tenantId);
  }
}
