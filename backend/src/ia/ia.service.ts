import { Injectable } from '@nestjs/common';
import { IaClientService } from './ia-client.service';
import { ReportesService } from '../reportes/reportes.service';
import { CuentasContablesService } from '../contabilidad/cuentas-contables.service';

interface CuentaSugerida {
  codigo: string;
  nombre: string;
  fuente: 'IA' | 'HEURISTICA';
}

@Injectable()
export class IaService {
  constructor(
    private readonly iaClient: IaClientService,
    private readonly reportesService: ReportesService,
    private readonly cuentasContablesService: CuentasContablesService,
  ) {}

  /**
   * Responde en lenguaje natural usando el dashboard real del tenant como
   * contexto. Sin `ANTHROPIC_API_KEY`, devuelve el resumen numérico crudo
   * en vez de prosa generada — sigue siendo información real y útil, solo
   * sin la capa de lenguaje natural.
   */
  async preguntarAsistente(pregunta: string, tenantId: string) {
    const dashboard = await this.reportesService.dashboard(tenantId);
    const contexto = `Ventas de hoy: RD$${dashboard.ventasHoyTotal} en ${dashboard.facturasHoyCantidad} factura(s). Productos con stock bajo: ${dashboard.productosStockBajo}. Órdenes de compra pendientes: ${dashboard.ordenesCompraPendientes}.`;

    if (!this.iaClient.habilitado) {
      return {
        respuesta: `Modo básico (sin IA configurada) — datos actuales del negocio: ${contexto}`,
        generadaConIa: false,
      };
    }

    const prompt = `Eres el asistente de negocio de un sistema de facturación dominicano. Con estos datos reales del tenant: ${contexto}\n\nResponde en español, en 2-3 oraciones, esta pregunta del usuario: "${pregunta}"`;
    const respuesta = await this.iaClient.completar(prompt, 300);

    return respuesta
      ? { respuesta, generadaConIa: true }
      : { respuesta: `No se pudo contactar al servicio de IA. Datos actuales del negocio: ${contexto}`, generadaConIa: false };
  }

  /** Sugiere una cuenta del catálogo del tenant para un gasto sin categorizar — vía IA si está disponible, si no por coincidencia de palabras. */
  async sugerirCuentaContable(concepto: string): Promise<CuentaSugerida | null> {
    const cuentas = await this.cuentasContablesService.listar();
    const cuentasGasto = cuentas.filter((c) => c.tipo === 'GASTO' || c.tipo === 'ACTIVO');

    if (this.iaClient.habilitado) {
      const opciones = cuentasGasto.map((c) => `${c.codigo}: ${c.nombre}`).join('\n');
      const prompt = `Catálogo de cuentas contables disponibles:\n${opciones}\n\nPara este gasto: "${concepto}", responde ÚNICAMENTE con el código de la cuenta más apropiada (solo el código, nada más).`;
      const respuesta = await this.iaClient.completar(prompt, 20);
      const codigo = respuesta?.trim();
      const cuenta = cuentasGasto.find((c) => c.codigo === codigo);
      if (cuenta) {
        return { codigo: cuenta.codigo, nombre: cuenta.nombre, fuente: 'IA' };
      }
    }

    return this.sugerirPorHeuristica(concepto, cuentasGasto);
  }

  private sugerirPorHeuristica(concepto: string, cuentas: { codigo: string; nombre: string }[]): CuentaSugerida | null {
    const palabrasConcepto = normalizar(concepto).split(/\s+/).filter((p) => p.length > 2);
    let mejor: { cuenta: { codigo: string; nombre: string }; puntaje: number } | null = null;

    for (const cuenta of cuentas) {
      const palabrasCuenta = new Set(normalizar(cuenta.nombre).split(/\s+/));
      const puntaje = palabrasConcepto.filter((p) => palabrasCuenta.has(p)).length;
      if (puntaje > 0 && (!mejor || puntaje > mejor.puntaje)) {
        mejor = { cuenta, puntaje };
      }
    }

    return mejor ? { codigo: mejor.cuenta.codigo, nombre: mejor.cuenta.nombre, fuente: 'HEURISTICA' } : null;
  }

  async generarDescripcionProducto(nombre: string, categoria?: string) {
    if (!this.iaClient.habilitado) {
      return { descripcion: `${nombre}${categoria ? ` — ${categoria}` : ''}. Descripción generada automáticamente sin IA (configure ANTHROPIC_API_KEY para una versión redactada).`, generadaConIa: false };
    }

    const prompt = `Escribe una descripción de venta corta (máximo 2 oraciones, en español, para República Dominicana) para este producto: "${nombre}"${categoria ? ` (categoría: ${categoria})` : ''}.`;
    const respuesta = await this.iaClient.completar(prompt, 150);

    return respuesta ? { descripcion: respuesta.trim(), generadaConIa: true } : { descripcion: nombre, generadaConIa: false };
  }
}

const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}
