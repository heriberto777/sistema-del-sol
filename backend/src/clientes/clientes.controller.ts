import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ClientesService } from './clientes.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { EstadoCuentaClienteQueryDto } from './dto/estado-cuenta-cliente-query.dto';
import { EnviarEstadoCuentaDto } from './dto/enviar-estado-cuenta.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Permissions('clientes.crear')
  crear(@Body() dto: CrearClienteDto, @CurrentUser() user: JwtPayloadUser) {
    return this.clientesService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('clientes.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.clientesService.listar(query);
  }

  // Antes de ':id' a propósito — si no, Nest matchea "consumidor-final"
  // como si fuera un :id (ambas son rutas GET /clientes/*, el orden de
  // declaración decide).
  @Get('consumidor-final')
  @Permissions('clientes.ver')
  consumidorFinal() {
    return this.clientesService.buscarConsumidorFinal();
  }

  @Get(':id')
  @Permissions('clientes.ver')
  buscarPorId(@Param('id') id: string) {
    return this.clientesService.buscarPorId(id);
  }

  @Get(':id/estado-cuenta')
  @Permissions('clientes.ver')
  estadoCuenta(@Param('id') id: string, @Query() query: EstadoCuentaClienteQueryDto) {
    return this.clientesService.estadoCuenta(id, query.desde, query.hasta);
  }

  @Get(':id/estado-cuenta/pdf')
  @Permissions('clientes.ver')
  async estadoCuentaPdf(@Param('id') id: string, @Query() query: EstadoCuentaClienteQueryDto, @CurrentUser() user: JwtPayloadUser, @Res() res: Response) {
    const buffer = await this.clientesService.estadoCuentaPdf(id, user.tenantId, query.desde, query.hasta);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="estado-de-cuenta.pdf"' });
    res.send(buffer);
  }

  @Post(':id/estado-cuenta/enviar')
  @Permissions('clientes.ver')
  enviarEstadoCuenta(@Param('id') id: string, @Body() dto: EnviarEstadoCuentaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.clientesService.enviarEstadoCuenta(id, user.tenantId, dto);
  }

  @Patch(':id')
  @Permissions('clientes.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearClienteDto>) {
    return this.clientesService.actualizar(id, dto);
  }
}
