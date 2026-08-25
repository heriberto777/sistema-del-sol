import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VariantesRepository } from './variantes.repository';
import { AtributosRepository } from '../atributos/atributos.repository';

/** Salvavidas contra una combinatoria descontrolada (varios atributos con muchos valores cada uno) — no es un límite de negocio, solo evita que un request dispare miles de inserts. */
const MAX_COMBINACIONES = 400;

export interface SeleccionAtributo {
  atributoId: string;
  valoresIds: string[];
}

@Injectable()
export class VariantesService {
  constructor(
    private readonly variantesRepository: VariantesRepository,
    private readonly atributosRepository: AtributosRepository,
  ) {}

  /**
   * `bodegaId` opcional (plan de integración Cuadre — POS, selector de
   * variante): además de los atributos, resuelve `existencia` (disponible
   * = `cantidadActual - cantidadReservada`, 0 si nunca se cargó Stock para
   * esa variante en esa bodega) — puramente informativo, el POS no
   * bloquea la venta por esto (el backend ya rechaza el cobro si de
   * verdad no alcanza, ver `descontarStockCondicionalEnTx`). Sin
   * `bodegaId`, se comporta igual que antes (sin el campo `existencia`).
   */
  async listarPorProducto(productoId: string, bodegaId?: string) {
    const variantes = await this.variantesRepository.listarPorProducto(productoId, bodegaId);
    if (!bodegaId) return variantes;
    return variantes.map(({ stock, ...variante }) => ({
      ...variante,
      existencia: Number(stock?.[0]?.cantidadActual ?? 0) - Number(stock?.[0]?.cantidadReservada ?? 0),
    }));
  }

  /**
   * Fase 3d — código de barras por variante, para que un lector USB
   * (o tipear el código a mano) matchee el buscador de catálogo/POS
   * (ver ProductosRepository.whereBusqueda). `productoId` viene de la
   * URL (`/productos/:productoId/variantes/:varianteId`) — se valida
   * que la variante realmente le pertenezca antes de tocarla, mismo
   * patrón de IDOR que el resto de FKs cliente-suministradas.
   */
  async actualizarCodigoBarras(productoId: string, varianteId: string, codigoBarras: string | null) {
    const variantes = await this.variantesRepository.listarIdsPorProducto(productoId);
    if (!variantes.some((v) => v.id === varianteId)) {
      throw new BadRequestException(`La variante indicada no pertenece al producto ${productoId}`);
    }
    return this.variantesRepository.actualizarCodigoBarras(varianteId, codigoBarras);
  }

  /**
   * Resolución obligatoria de variante para líneas de venta/compra (Fase
   * 3c, incremento 3): si el producto tiene una sola variante (el caso
   * normal — nunca usó atributos reales), se resuelve sola sin que el
   * caller tenga que elegir nada. Si tiene más de una, `varianteId`
   * explícito es obligatorio (400 si falta) — y se valida que esa
   * variante realmente pertenezca a este producto (mismo patrón de
   * prevención de IDOR que el resto de FKs cliente-suministradas).
   */
  async resolverObligatoria(productoId: string, varianteId?: string): Promise<string> {
    const variantes = await this.variantesRepository.listarIdsPorProducto(productoId);
    if (varianteId) {
      if (!variantes.some((v) => v.id === varianteId)) {
        throw new BadRequestException(`La variante indicada no pertenece al producto ${productoId}`);
      }
      return varianteId;
    }
    // Un producto real siempre tiene al menos una variante (la "por
    // defecto", sembrada al crearlo) — cero variantes solo pasa si
    // productoId no existe (o es de otro tenant). Sin este check,
    // `variantes[0].id` explota con un TypeError crudo en vez de un 404
    // claro (bug real, encontrado por un e2e de atomicidad en Compras).
    if (variantes.length === 0) {
      throw new NotFoundException(`Producto ${productoId} no encontrado`);
    }
    if (variantes.length > 1) {
      throw new BadRequestException(`El producto ${productoId} tiene varias variantes — indicá varianteId en la línea`);
    }
    return variantes[0].id;
  }

  /**
   * Genera el producto cartesiano de los valores elegidos por atributo —
   * una `VarianteProducto` por combinación — y reemplaza por completo las
   * variantes actuales del producto (mismo patrón "borrar y recrear" que
   * `ComponenteCombo`). `seleccion: []` (sin atributos) genera una única
   * variante "por defecto", sin valores — el mismo estado que tiene
   * cualquier producto que nunca usó atributos reales.
   */
  async generarCombinaciones(productoId: string, tenantId: string, seleccion: SeleccionAtributo[]) {
    const grupos = await Promise.all(
      seleccion.map(async ({ atributoId, valoresIds }) => {
        if (!valoresIds.length) {
          throw new BadRequestException('Cada atributo elegido necesita al menos un valor seleccionado');
        }
        // findUniqueOrThrow tenant-scoped: si atributoId es de otro tenant, 404 —
        // mismo patrón de prevención de IDOR ya documentado para FKs cliente-suministradas.
        const atributo = await this.atributosRepository.buscarPorId(atributoId);
        const idsValidos = new Set(atributo.valores.map((v) => v.id));
        const invalido = valoresIds.find((id) => !idsValidos.has(id));
        if (invalido) {
          throw new BadRequestException(`El valor ${invalido} no pertenece al atributo "${atributo.nombre}"`);
        }
        return valoresIds;
      }),
    );

    const combinaciones = grupos.reduce<string[][]>(
      (acc, valores) => acc.flatMap((combo) => valores.map((v) => [...combo, v])),
      [[]],
    );

    if (combinaciones.length > MAX_COMBINACIONES) {
      throw new BadRequestException(
        `La combinación elegida generaría ${combinaciones.length} variantes — el máximo soportado es ${MAX_COMBINACIONES}. Elegí menos atributos o menos valores.`,
      );
    }

    const existentes = await this.variantesRepository.listarPorProducto(productoId);
    const idsExistentes = existentes.map((v) => v.id);
    const [movimientos, usoEnLineas] = await Promise.all([
      this.variantesRepository.contarMovimientos(idsExistentes),
      this.variantesRepository.contarUsoEnLineas(idsExistentes),
    ]);
    if (movimientos > 0 || usoEnLineas > 0) {
      throw new BadRequestException(
        'No se pueden regenerar las variantes: este producto ya tiene movimientos de inventario o líneas de venta/compra registradas contra sus variantes actuales.',
      );
    }

    return this.variantesRepository.regenerar(productoId, tenantId, combinaciones);
  }
}
