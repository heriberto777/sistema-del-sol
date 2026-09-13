import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoTravelReserva } from '@prisma/client';
import { TravelReglaMarkupRepository } from './travel-regla-markup.repository';
import { CrearReglaMarkupDto } from './dto/crear-regla-markup.dto';

/**
 * Markup automático — antes YAGNI (ver comentario en schema.prisma sobre
 * TravelReserva.montoCosto/montoVenta), ahora que hay pricing real de un
 * proveedor (Duffel) que automatizar. Nunca reemplaza el criterio del
 * agente: `sugerir()` solo calcula un valor de partida editable, jamás
 * escribe nada en la reserva.
 */
@Injectable()
export class TravelReglaMarkupService {
  constructor(private readonly repository: TravelReglaMarkupRepository) {}

  async crear(dto: CrearReglaMarkupDto, tenantId: string) {
    this.validarExactamenteUno(dto);
    return this.repository.crear(dto, tenantId);
  }

  listar() {
    return this.repository.listar();
  }

  async actualizar(id: string, dto: Partial<CrearReglaMarkupDto>) {
    if (dto.porcentaje !== undefined || dto.montoFijo !== undefined) {
      const actual = await this.repository.buscarPorId(id);
      this.validarExactamenteUno({
        porcentaje: dto.porcentaje !== undefined ? dto.porcentaje : (actual.porcentaje ?? undefined),
        montoFijo: dto.montoFijo !== undefined ? dto.montoFijo : (actual.montoFijo ?? undefined),
      } as never);
    }
    return this.repository.actualizar(id, dto);
  }

  eliminar(id: string) {
    return this.repository.eliminar(id);
  }

  private validarExactamenteUno(dto: { porcentaje?: number | null; montoFijo?: number | null }) {
    const tienePorcentaje = dto.porcentaje !== undefined && dto.porcentaje !== null;
    const tieneMontoFijo = dto.montoFijo !== undefined && dto.montoFijo !== null;
    if (tienePorcentaje === tieneMontoFijo) {
      throw new BadRequestException('Una regla de markup necesita exactamente uno: porcentaje o montoFijo (no ambos, no ninguno).');
    }
  }

  /** Nunca escribe nada — solo calcula. Sin regla activa, sugiere el propio costo (markup 0%, mismo comportamiento de hoy). */
  async sugerir(tipo: TipoTravelReserva, montoCosto: number) {
    const regla = await this.repository.buscarActivaPara(tipo);
    if (!regla) return { montoVentaSugerido: montoCosto, reglaAplicada: null };

    const montoVentaSugerido = regla.porcentaje
      ? Math.round(montoCosto * (1 + Number(regla.porcentaje) / 100) * 100) / 100
      : Math.round((montoCosto + Number(regla.montoFijo)) * 100) / 100;

    return { montoVentaSugerido, reglaAplicada: { id: regla.id, tipo: regla.tipo, porcentaje: regla.porcentaje, montoFijo: regla.montoFijo } };
  }
}
