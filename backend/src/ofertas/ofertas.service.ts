import { BadRequestException, Injectable } from '@nestjs/common';
import { Oferta } from '@prisma/client';
import { OfertasRepository } from './ofertas.repository';
import { CrearOfertaDto } from './dto/crear-oferta.dto';

@Injectable()
export class OfertasService {
  constructor(private readonly ofertasRepository: OfertasRepository) {}

  listar() {
    return this.ofertasRepository.listar();
  }

  async crear(dto: CrearOfertaDto, tenantId: string) {
    this.validarAlcance(dto);
    this.validarTipoDescuento(dto);
    return this.ofertasRepository.crear(dto, tenantId);
  }

  async actualizar(id: string, dto: Partial<CrearOfertaDto>) {
    const actual = await this.ofertasRepository.buscarPorId(id);
    const combinado = { ...actual, ...dto } as CrearOfertaDto;
    this.validarAlcance(combinado);
    this.validarTipoDescuento(combinado);
    return this.ofertasRepository.actualizar(id, dto);
  }

  eliminar(id: string) {
    return this.ofertasRepository.eliminar(id);
  }

  /**
   * `productoId`/`categoriaId`/`montoMinimoCarrito` son mutuamente
   * exclusivos según `alcance` — el schema no lo puede exigir (son todos
   * columnas nullable), así que se valida acá, mismo criterio que
   * `ProductosService.validarComponentes` para las reglas de COMBO.
   */
  private validarAlcance(dto: CrearOfertaDto) {
    if (new Date(dto.fechaFin) < new Date(dto.fechaInicio)) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio');
    }
    if (dto.alcance === 'PRODUCTO') {
      if (!dto.productoId) throw new BadRequestException('Una oferta de alcance PRODUCTO necesita productoId');
      if (dto.categoriaId || dto.montoMinimoCarrito) {
        throw new BadRequestException('Una oferta de alcance PRODUCTO no acepta categoriaId ni montoMinimoCarrito');
      }
    } else if (dto.alcance === 'CATEGORIA') {
      if (!dto.categoriaId) throw new BadRequestException('Una oferta de alcance CATEGORIA necesita categoriaId');
      if (dto.productoId || dto.montoMinimoCarrito) {
        throw new BadRequestException('Una oferta de alcance CATEGORIA no acepta productoId ni montoMinimoCarrito');
      }
    } else {
      if (dto.productoId || dto.categoriaId) {
        throw new BadRequestException('Una oferta de alcance CARRITO no acepta productoId ni categoriaId');
      }
      // Ítem A-2: "compra X lleva Y" no tiene sentido sobre el total del
      // carrito (no hay una "unidad" a contar) — solo PRODUCTO/CATEGORIA.
      if (dto.tipoDescuento === 'BOGO') {
        throw new BadRequestException('BOGO no aplica a ofertas de alcance CARRITO — usá PRODUCTO o CATEGORIA');
      }
    }
  }

  /** Ítem A-2 — BOGO usa comprarCantidad/llevarCantidad en vez de `valor`. */
  private validarTipoDescuento(dto: CrearOfertaDto) {
    if (dto.tipoDescuento === 'BOGO') {
      if (!dto.comprarCantidad || !dto.llevarCantidad) {
        throw new BadRequestException('Una oferta BOGO necesita comprarCantidad y llevarCantidad');
      }
    } else if (dto.valor === undefined || dto.valor === null) {
      throw new BadRequestException('valor es obligatorio para ofertas PORCENTAJE/MONTO_FIJO');
    }
  }

  /**
   * Monto de descuento de UNA oferta sobre una base dada — `cantidad`/
   * `precioUnitario` solo se usan para BOGO (necesita contar unidades,
   * no solo un monto). Siempre respeta `descuentoMaximoMonto` (ítem A-2)
   * y nunca supera la propia `base` que descuenta.
   */
  private montoDescuentoOferta(oferta: Oferta, base: number, cantidad?: number, precioUnitario?: number): number {
    let bruto: number;
    if (oferta.tipoDescuento === 'PORCENTAJE') {
      bruto = base * (Number(oferta.valor) / 100);
    } else if (oferta.tipoDescuento === 'MONTO_FIJO') {
      bruto = Number(oferta.valor);
    } else {
      // BOGO: por cada grupo COMPLETO de (comprarCantidad + llevarCantidad)
      // unidades, `llevarCantidad` de ellas llevan el % de descuento — las
      // unidades sueltas de un grupo incompleto no llevan nada (mismo
      // criterio que cualquier promoción real: hay que completar la compra).
      if (!cantidad || !precioUnitario || !oferta.comprarCantidad || !oferta.llevarCantidad) return 0;
      const tamanoGrupo = oferta.comprarCantidad + oferta.llevarCantidad;
      const gruposCompletos = Math.floor(cantidad / tamanoGrupo);
      const unidadesConDescuento = gruposCompletos * oferta.llevarCantidad;
      bruto = unidadesConDescuento * precioUnitario * (Number(oferta.porcentajeDescuentoLlevar ?? 100) / 100);
    }
    if (oferta.descuentoMaximoMonto != null) {
      bruto = Math.min(bruto, Number(oferta.descuentoMaximoMonto));
    }
    // El descuento nunca puede superar el monto que descuenta — un
    // MONTO_FIJO más grande que la línea/carrito dejaría un total negativo.
    return Math.min(bruto, base);
  }

  /**
   * Combina varias ofertas vigentes que matchean la misma línea/carrito
   * (ítem A-2, decisión confirmada con el usuario): se SUMAN todas las
   * marcadas `acumulable`, se toma la MEJOR entre las no acumulables por
   * separado (desempatada por `prioridad` — menor número gana), y el
   * resultado final es el que le dé MÁS descuento al cliente entre "sumar
   * los acumulables" o "aplicar la mejor no acumulable en exclusiva" —
   * nunca se combinan ambos grupos entre sí.
   */
  private combinarDescuentos(ofertas: Oferta[], base: number, cantidad?: number, precioUnitario?: number): number {
    return this.combinarDescuentosConComision(ofertas, base, cantidad, precioUnitario).monto;
  }

  /**
   * Igual que `combinarDescuentos`, pero además informa si el resultado
   * "paga comisión" (ítem A-1) — decisión "todo o nada": si el grupo de
   * ofertas que terminó ganando (los acumulables sumados, o la mejor no
   * acumulable en solitario) incluye alguna con `pagaComision: false`,
   * la línea entera queda sin comisión. En empate entre "sumar
   * acumulables" y "la mejor no acumulable" gana el lado acumulable
   * (mismo criterio arbitrario que ya tenía `Math.max` acá).
   */
  private combinarDescuentosConComision(
    ofertas: Oferta[],
    base: number,
    cantidad?: number,
    precioUnitario?: number,
  ): { monto: number; pagaComision: boolean } {
    const acumulablesConMonto = ofertas
      .filter((o) => o.acumulable)
      .map((oferta) => ({ oferta, monto: this.montoDescuentoOferta(oferta, base, cantidad, precioUnitario) }))
      .filter((x) => x.monto > 0);
    const totalAcumulables = acumulablesConMonto.reduce((acc, x) => acc + x.monto, 0);

    const noAcumulables = [...ofertas.filter((o) => !o.acumulable)].sort((a, b) => a.prioridad - b.prioridad);
    let mejorNoAcumulable = 0;
    let mejorOferta: Oferta | null = null;
    for (const oferta of noAcumulables) {
      const monto = this.montoDescuentoOferta(oferta, base, cantidad, precioUnitario);
      if (monto > mejorNoAcumulable) {
        mejorNoAcumulable = monto;
        mejorOferta = oferta;
      }
    }

    if (totalAcumulables >= mejorNoAcumulable) {
      const monto = Math.min(totalAcumulables, base);
      return { monto, pagaComision: monto === 0 || acumulablesConMonto.every((x) => x.oferta.pagaComision) };
    }
    const monto = Math.min(mejorNoAcumulable, base);
    return { monto, pagaComision: mejorOferta ? mejorOferta.pagaComision : true };
  }

  /**
   * Único punto de resolución de descuento automático por línea (Fase 4b)
   * — reusado por Facturación/Cotizaciones, igual patrón que
   * `VariantesService.resolverObligatoria`.
   */
  async resolverDescuentoLinea(productoId: string, categoriaId: string | null, cantidad: number, precioUnitario: number): Promise<number> {
    return (await this.resolverDescuentoLineaConComision(productoId, categoriaId, cantidad, precioUnitario)).monto;
  }

  /**
   * Igual que `resolverDescuentoLinea`, pero además informa si la línea
   * "paga comisión" (ítem A-1) — usada solo por `FacturacionService`
   * (Cotizaciones no genera comisión, así que sigue usando la versión
   * simple de arriba).
   */
  async resolverDescuentoLineaConComision(
    productoId: string,
    categoriaId: string | null,
    cantidad: number,
    precioUnitario: number,
  ): Promise<{ monto: number; pagaComision: boolean }> {
    const monto = cantidad * precioUnitario;
    if (monto <= 0) return { monto: 0, pagaComision: true };
    const ofertas = await this.ofertasRepository.buscarVigentesParaLinea(productoId, categoriaId, new Date());
    if (ofertas.length === 0) return { monto: 0, pagaComision: true };
    return this.combinarDescuentosConComision(ofertas, monto, cantidad, precioUnitario);
  }

  /**
   * Total de descuento de carrito (Fase 4b) — el caller (Facturación/
   * Cotizaciones) reparte este monto entre las líneas con
   * `prorratearDescuentoCarrito` para no romper el ITBIS por línea.
   * `montoMinimoCarrito` null en la oferta = sin mínimo, siempre aplica.
   */
  async resolverDescuentoCarritoTotal(subtotalLineas: number): Promise<number> {
    if (subtotalLineas <= 0) return 0;
    const ofertas = (await this.ofertasRepository.buscarVigentesDeCarrito(new Date())).filter(
      (o) => o.montoMinimoCarrito === null || subtotalLineas >= Number(o.montoMinimoCarrito),
    );
    if (ofertas.length === 0) return 0;
    return this.combinarDescuentos(ofertas, subtotalLineas);
  }

  /**
   * Fase 13 — oferta a mostrar en la tarjeta de producto del storefront
   * público (catálogo/destacados/relacionados), en vez de solo la
   * sección "Ofertas" informativa. Reusa la MISMA `combinarDescuentosConComision`
   * que ya resuelve la venta real (a `cantidad=1`) para que el precio
   * mostrado en la tarjeta nunca diverja del que termina cobrando
   * Facturación/POS. BOGO a `cantidad=1` siempre da `monto=0`
   * (`montoDescuentoOferta` exige `cantidad`/`precioUnitario` reales de
   * una compra) — por eso, si no hay descuento de precio, se busca por
   * separado si hay una BOGO vigente para mostrar su mecánica como
   * insignia (nunca un "precio unitario con descuento" inventado).
   */
  async resolverOfertaVisibleProducto(
    productoId: string,
    categoriaId: string | null,
    precioUnitario: number,
  ): Promise<OfertaVisibleProducto | null> {
    if (precioUnitario <= 0) return null;
    const ofertas = await this.ofertasRepository.buscarVigentesParaLinea(productoId, categoriaId, new Date());
    if (ofertas.length === 0) return null;

    const { monto } = this.combinarDescuentosConComision(ofertas, precioUnitario, 1, precioUnitario);
    if (monto > 0) {
      return {
        tipo: 'DESCUENTO',
        precioConDescuento: precioUnitario - monto,
        ahorro: monto,
        porcentaje: Math.round((monto / precioUnitario) * 100),
      };
    }

    const bogo = ofertas.find((o) => o.tipoDescuento === 'BOGO');
    if (bogo) {
      return {
        tipo: 'BOGO',
        comprarCantidad: bogo.comprarCantidad ?? 1,
        llevarCantidad: bogo.llevarCantidad ?? 1,
        porcentajeDescuentoLlevar: Number(bogo.porcentajeDescuentoLlevar ?? 100),
      };
    }
    return null;
  }
}

export type OfertaVisibleProducto =
  | { tipo: 'DESCUENTO'; precioConDescuento: number; ahorro: number; porcentaje: number }
  | { tipo: 'BOGO'; comprarCantidad: number; llevarCantidad: number; porcentajeDescuentoLlevar: number };
