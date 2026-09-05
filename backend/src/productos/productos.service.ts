import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TipoProducto } from '@prisma/client';
import { ProductosRepository } from './productos.repository';
import { CrearProductoDto, ComponenteComboDto } from './dto/crear-producto.dto';
import { CatalogoQueryDto } from './dto/catalogo-query.dto';
import { ImportarProductosDto, FilaImportarProductoDto } from './dto/importar-productos.dto';
import { paginar } from '../common/types/pagina-resultado';
import { CategoriasRepository } from '../categorias/categorias.repository';
import { LeyesFiscalesRepository } from '../leyes-fiscales/leyes-fiscales.repository';
import { VariantesService } from '../variantes/variantes.service';
import { PreciosRepository } from '../precios/precios.repository';
import { generarExcel } from '../reportes/exportadores/excel-exportador';
import type { ArchivoGenerado } from '../reportes/reportes.service';
import { AnalizadorImagenService } from '../ia/analizador-imagen/analizador-imagen.service';

export interface ResumenImportacion {
  creados: number;
  actualizados: number;
  errores: { codigo: string; mensaje: string }[];
}

@Injectable()
export class ProductosService {
  constructor(
    private readonly productosRepository: ProductosRepository,
    private readonly categoriasRepository: CategoriasRepository,
    private readonly leyesFiscalesRepository: LeyesFiscalesRepository,
    private readonly variantesService: VariantesService,
    private readonly preciosRepository: PreciosRepository,
    private readonly analizadorImagenService: AnalizadorImagenService,
  ) {}

  /**
   * Pedido explícito — sugiere nombre/descripción a partir de la foto,
   * gateado por `productos.ia_generar` (ver ProductosController). El admin
   * elige cuál candidato usar; nunca se aplica sola. `detalle` es un texto
   * corto opcional (marca, material, talla, uso, etc.) que el admin ya
   * conoce y la foto sola no puede confirmar.
   */
  async analizarImagen(imagen: string, detalle?: string) {
    const opciones = await this.analizadorImagenService.analizarDesdeDataUri(imagen, detalle);
    return { opciones };
  }

  async crear(dto: CrearProductoDto, tenantId: string) {
    const tipoEfectivo = dto.tipo ?? 'PRODUCTO';
    await this.validarComponentes(dto.componentes, tipoEfectivo);
    this.validarComision(dto.porcentajeComision, dto.montoComisionFijo);
    if (dto.categoriaId) {
      // findUniqueOrThrow tenant-scoped: si categoriaId es de otro tenant, 404.
      await this.categoriasRepository.buscarPorId(dto.categoriaId);
    }
    if (dto.leyFiscalId) {
      await this.leyesFiscalesRepository.buscarPorId(dto.leyFiscalId);
    }
    return this.productosRepository.crear(dto, tenantId);
  }

  async listar(query: CatalogoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.productosRepository.listar({
      skip,
      take,
      busqueda: query.busqueda,
      categoriaId: query.categoriaId,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  async catalogo(query: CatalogoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [filas, total] = await this.productosRepository.catalogo({
      skip,
      take,
      busqueda: query.busqueda,
      categoriaId: query.categoriaId,
    });
    const datos = filas.map(({ precios, ...producto }) => ({ ...producto, precioVenta: precios[0]?.precioVenta ?? null }));
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.productosRepository.buscarPorId(id);
  }

  buscarPorIdEnTx(tx: Prisma.TransactionClient, id: string) {
    return this.productosRepository.buscarPorIdEnTx(tx, id);
  }

  async actualizar(id: string, dto: Partial<CrearProductoDto>, tenantId: string) {
    if (dto.categoriaId) {
      await this.categoriasRepository.buscarPorId(dto.categoriaId);
    }
    if (dto.leyFiscalId) {
      await this.leyesFiscalesRepository.buscarPorId(dto.leyFiscalId);
    }
    if (dto.porcentajeComision !== undefined || dto.montoComisionFijo !== undefined) {
      const actual = await this.productosRepository.buscarPorId(id);
      const porcentajeComision = dto.porcentajeComision !== undefined ? dto.porcentajeComision : Number(actual.porcentajeComision ?? 0) || null;
      const montoComisionFijo = dto.montoComisionFijo !== undefined ? dto.montoComisionFijo : Number(actual.montoComisionFijo ?? 0) || null;
      this.validarComision(porcentajeComision, montoComisionFijo);
    }

    if (dto.atributos !== undefined) {
      await this.variantesService.generarCombinaciones(id, tenantId, dto.atributos);
    }

    if (dto.tipo === undefined && dto.componentes === undefined) {
      return this.productosRepository.actualizar(id, dto);
    }

    const actual = await this.productosRepository.buscarPorId(id);
    const tipoEfectivo = dto.tipo ?? actual.tipo;
    // Si deja de ser COMBO (o nunca lo fue), no tiene sentido conservar
    // componentes viejos colgando — se limpian a propósito, aunque el
    // caller no haya mandado `componentes` explícitamente.
    const componentes = tipoEfectivo === 'COMBO' ? dto.componentes : [];

    await this.validarComponentes(componentes, tipoEfectivo, id);
    return this.productosRepository.actualizar(id, { ...dto, componentes });
  }

  /** Fase 3e — export a Excel del catálogo completo (reusa generarExcel(), mismo patrón que ReportesService). */
  async exportar(): Promise<ArchivoGenerado> {
    const productos = await this.productosRepository.exportarDatos();

    const filas = productos.map((p) => {
      // Igual criterio que ProductosRepository.catalogo(): la variante más
      // antigua (variantes[0], ya viene ordenada createdAt asc) es la
      // "representativa" para el precio GENERAL de referencia. Código de
      // barras y stock, en cambio, se agregan sobre TODAS las variantes.
      const precioGeneral = p.variantes[0]?.precios[0]?.precioVenta;
      const stockTotal = p.variantes.reduce(
        (acc, v) => acc + v.stock.reduce((a, s) => a + Number(s.cantidadActual), 0),
        0,
      );
      const codigosBarras = p.variantes.map((v) => v.codigoBarras).filter((c): c is string => !!c).join(', ');

      return {
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria?.nombre ?? '',
        tipo: p.tipo,
        unidad: p.unidadMedida,
        itbis: Number(p.porcentajeItbis).toString(),
        precioGeneral: precioGeneral !== undefined ? Number(precioGeneral).toFixed(2) : '',
        codigoBarras: codigosBarras,
        stockTotal: stockTotal.toString(),
      };
    });

    const buffer = await generarExcel(
      'Productos',
      [
        { header: 'Código', key: 'codigo' },
        { header: 'Nombre', key: 'nombre', width: 28 },
        { header: 'Categoría', key: 'categoria', width: 20 },
        { header: 'Tipo', key: 'tipo' },
        { header: 'Unidad', key: 'unidad' },
        { header: 'ITBIS %', key: 'itbis' },
        { header: 'Precio GENERAL', key: 'precioGeneral' },
        { header: 'Código de barras', key: 'codigoBarras', width: 20 },
        { header: 'Stock total', key: 'stockTotal' },
      ],
      filas,
    );
    return {
      buffer,
      nombreArchivo: 'productos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Fase 3e — import masivo, upsert por código. Cada fila se procesa de
   * forma independiente (un error en una no aborta las demás) — por eso
   * el resumen distingue creados/actualizados/errores en vez de ser
   * todo-o-nada. Deliberadamente NO soporta: productos COMBO (sin forma
   * razonable de expresar `componentes` en una fila plana), variantes
   * reales de Talla/Color (el código de barras siempre se asigna a la
   * variante "por defecto"), ni stock (se gestiona vía Inventario, no
   * sobreescribiéndolo desde un catálogo).
   */
  async importar(dto: ImportarProductosDto, tenantId: string): Promise<ResumenImportacion> {
    const resumen: ResumenImportacion = { creados: 0, actualizados: 0, errores: [] };

    for (const fila of dto.productos) {
      try {
        await this.importarFila(fila, tenantId, resumen);
      } catch (err) {
        resumen.errores.push({ codigo: fila.codigo, mensaje: err instanceof Error ? err.message : 'Error desconocido' });
      }
    }

    return resumen;
  }

  private async importarFila(fila: FilaImportarProductoDto, tenantId: string, resumen: ResumenImportacion) {
    let categoriaId: string | undefined;
    if (fila.categoria) {
      const existente = await this.categoriasRepository.buscarPorNombre(fila.categoria);
      categoriaId = existente ? existente.id : (await this.categoriasRepository.crear({ nombre: fila.categoria }, tenantId)).id;
    }

    const productoExistente = await this.productosRepository.buscarPorCodigo(fila.codigo);
    let productoId: string;
    if (productoExistente) {
      await this.productosRepository.actualizar(productoExistente.id, {
        nombre: fila.nombre,
        ...(categoriaId !== undefined ? { categoriaId } : {}),
        ...(fila.unidadMedida !== undefined ? { unidadMedida: fila.unidadMedida } : {}),
        ...(fila.porcentajeItbis !== undefined ? { porcentajeItbis: fila.porcentajeItbis } : {}),
      });
      productoId = productoExistente.id;
      resumen.actualizados++;
    } else {
      const creado = await this.productosRepository.crear(
        {
          codigo: fila.codigo,
          nombre: fila.nombre,
          categoriaId,
          unidadMedida: fila.unidadMedida,
          porcentajeItbis: fila.porcentajeItbis,
          tipo: fila.tipo ?? 'PRODUCTO',
        },
        tenantId,
      );
      productoId = creado.id;
      resumen.creados++;
    }

    // `resolverObligatoria` sin varianteId explota (400) si el producto
    // (ya existente, editado antes vía la UI) tiene variantes reales de
    // Talla/Color — a propósito: esta fila ya actualizó código/nombre/
    // categoría con éxito antes de llegar acá, así que ese código termina
    // contando en creados/actualizados Y en errores a la vez, lo cual es
    // correcto: el producto sí se tocó, pero el precio/código de barras
    // de esta fila no se pudo aplicar sin saber a cuál variante.
    if (fila.precioGeneral !== undefined) {
      const varianteId = await this.variantesService.resolverObligatoria(productoId);
      // Sin desglose costo/margen en una fila de importación masiva —
      // costo = precioVenta (margen 0) es el punto de partida más simple;
      // se refina después desde la pantalla de Precios si hace falta.
      await this.preciosRepository.crear({
        varianteId,
        listaPrecio: 'GENERAL',
        costo: fila.precioGeneral,
        margenPct: 0,
        precioVenta: fila.precioGeneral,
      });
    }

    if (fila.codigoBarras !== undefined) {
      const varianteId = await this.variantesService.resolverObligatoria(productoId);
      await this.variantesService.actualizarCodigoBarras(productoId, varianteId, fila.codigoBarras);
    }
  }

  /**
   * Reglas de un combo, validadas en la capa de servicio antes de tocar la
   * base (ver docs del plan): los componentes solo tienen sentido en un
   * COMBO, un combo no puede componerse de sí mismo, y no se permiten
   * combos anidados (un componente no puede ser a su vez un COMBO) — sin
   * este límite, expandir el inventario al facturar necesitaría recursión
   * sin cota.
   */
  private async validarComponentes(
    componentes: ComponenteComboDto[] | undefined,
    tipoEfectivo: TipoProducto,
    idPropio?: string,
  ) {
    if (!componentes?.length) return;

    if (tipoEfectivo !== 'COMBO') {
      throw new BadRequestException('Solo un producto de tipo COMBO puede tener componentes');
    }
    if (idPropio && componentes.some((c) => c.productoId === idPropio)) {
      throw new BadRequestException('Un combo no puede tener un componente que sea el propio combo');
    }

    const productos = await Promise.all(componentes.map((c) => this.productosRepository.buscarPorId(c.productoId)));
    const comboAnidado = productos.find((p) => p.tipo === 'COMBO');
    if (comboAnidado) {
      throw new BadRequestException(`El producto "${comboAnidado.nombre}" es un combo — no se pueden anidar combos`);
    }
  }

  /** Ítem A-1 — porcentajeComision y montoComisionFijo son mutuamente excluyentes. */
  private validarComision(porcentajeComision?: number | null, montoComisionFijo?: number | null) {
    if (porcentajeComision != null && montoComisionFijo != null) {
      throw new BadRequestException('Un producto no puede tener porcentajeComision y montoComisionFijo a la vez — elegí uno');
    }
  }
}
