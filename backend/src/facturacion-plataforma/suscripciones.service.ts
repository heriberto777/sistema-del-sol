import { Injectable } from '@nestjs/common';
import { SuscripcionesRepository } from './suscripciones.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { ActualizarSuscripcionDto } from './dto/actualizar-suscripcion.dto';

@Injectable()
export class SuscripcionesService {
  constructor(
    private readonly suscripcionesRepository: SuscripcionesRepository,
    private readonly facturasPlataformaService: FacturasPlataformaService,
  ) {}

  buscarPorTenant(tenantId: string) {
    return this.suscripcionesRepository.buscarPorTenant(tenantId);
  }

  actualizar(tenantId: string, dto: ActualizarSuscripcionDto) {
    return this.suscripcionesRepository.actualizar(tenantId, dto);
  }

  async generarFacturaAhora(tenantId: string) {
    const suscripcion = await this.suscripcionesRepository.buscarPorTenant(tenantId);
    return this.facturasPlataformaService.generarDesdeSuscripcion(suscripcion);
  }

  async generarFacturaAdelantada(tenantId: string, ciclos: number) {
    const suscripcion = await this.suscripcionesRepository.buscarPorTenant(tenantId);
    return this.facturasPlataformaService.generarFacturaAdelantada(suscripcion, ciclos);
  }
}
