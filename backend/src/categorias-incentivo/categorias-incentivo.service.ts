import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CategoriasIncentivoRepository } from './categorias-incentivo.repository';
import { CrearCategoriaIncentivoDto } from './dto/crear-categoria-incentivo.dto';
import { ActualizarCategoriaIncentivoDto } from './dto/actualizar-categoria-incentivo.dto';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { WhatsAppChannel } from '../notificaciones/canales/whatsapp.channel';
import { PrismaService } from '../prisma/prisma.service';
import { ConversacionIaService } from '../ia/conversacion/conversacion-ia.service';
import { IaClientService } from '../ia/ia-client.service';
import { UsoIaService } from '../ia/uso-ia.service';
import { descifrar } from '../common/utils/encriptado.util';
import { construirEmailIncentivoHtml } from './construir-email-incentivo-html';

export interface RenglonResumenIncentivo {
  id: string;
  nombre: string;
  peso: number;
  tareasTotales: number;
  tareasCompletadas: number;
  porcentaje: number;
  montoGanado: number;
}

export interface TareaPendienteIncentivo {
  id: string;
  titulo: string;
  categoriaNombre: string | null;
}

export interface ResumenIncentivo {
  periodo: string;
  renglones: RenglonResumenIncentivo[];
  pesoTotal: number;
  montoGanadoTotal: number;
  porcentajeGeneral: number;
  tareasPendientes: TareaPendienteIncentivo[];
}

function formatoMonto(n: number): string {
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Renglones de incentivo IT (CIGUAS APPS, Backups, ITT, ...) — catálogo
 * simple por tenant, mismo criterio de "sin permisos propios" que
 * TareasPersonalesService: es parte de Mis Tareas, hoy siempre disponible
 * para cualquier usuario autenticado.
 */
@Injectable()
export class CategoriasIncentivoService {
  constructor(
    private readonly repository: CategoriasIncentivoRepository,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly prisma: PrismaService,
    private readonly conversacionIaService: ConversacionIaService,
    private readonly iaClientService: IaClientService,
    private readonly usoIaService: UsoIaService,
  ) {}

  crear(dto: CrearCategoriaIncentivoDto, tenantId: string) {
    return this.repository.crear(dto, tenantId);
  }

  listar() {
    return this.repository.listar();
  }

  listarDestinatarios() {
    return this.repository.listarDestinatarios();
  }

  actualizar(id: string, dto: ActualizarCategoriaIncentivoDto) {
    return this.repository.actualizar(id, dto);
  }

  // Borrar un renglón no borra las tareas que ya sumaron a él — su
  // categoriaIncentivoId cae a null (onDelete: SetNull), quedan como
  // "Sin incentivo" en el histórico.
  eliminar(id: string) {
    return this.repository.eliminar(id);
  }

  private rangoDelMes(mes: string): { desde: Date; hasta: Date; etiqueta: string } {
    const match = /^(\d{4})-(\d{2})$/.exec(mes);
    if (!match) throw new BadRequestException('El mes debe venir en formato YYYY-MM');
    const anio = Number(match[1]);
    const mesNum = Number(match[2]);
    const desde = new Date(Date.UTC(anio, mesNum - 1, 1));
    const hasta = new Date(Date.UTC(anio, mesNum, 0, 23, 59, 59, 999));
    const etiqueta = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(desde);
    return { desde, hasta, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) };
  }

  /**
   * % Renglón = tareas completadas ÷ tareas totales del período (0 si no
   * hubo ninguna asignada — a propósito no se asume 100%, para no premiar
   * un renglón sin ninguna tarea cargada ese mes). Monto ganado = peso ×
   * %. El "Cumplimiento general" es el monto ganado total sobre el peso
   * total, no un promedio simple de porcentajes — así un renglón grande
   * pesa más que uno chico, igual que en la matriz que armaste.
   */
  async resumen(mes: string): Promise<ResumenIncentivo> {
    const { desde, hasta, etiqueta } = this.rangoDelMes(mes);
    const [datos, pendientesRaw] = await Promise.all([
      this.repository.resumenPeriodo(desde, hasta),
      this.repository.listarPendientesPeriodo(desde, hasta),
    ]);

    const renglones: RenglonResumenIncentivo[] = datos.map(({ categoria, tareasTotales, tareasCompletadas }) => {
      const porcentaje = tareasTotales > 0 ? (tareasCompletadas / tareasTotales) * 100 : 0;
      const peso = Number(categoria.peso);
      return { id: categoria.id, nombre: categoria.nombre, peso, tareasTotales, tareasCompletadas, porcentaje, montoGanado: peso * (porcentaje / 100) };
    });

    const pesoTotal = renglones.reduce((acc, r) => acc + r.peso, 0);
    const montoGanadoTotal = renglones.reduce((acc, r) => acc + r.montoGanado, 0);
    const porcentajeGeneral = pesoTotal > 0 ? (montoGanadoTotal / pesoTotal) * 100 : 0;
    const tareasPendientes: TareaPendienteIncentivo[] = pendientesRaw.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      categoriaNombre: t.categoriaIncentivo?.nombre ?? null,
    }));

    return { periodo: etiqueta, renglones, pesoTotal, montoGanadoTotal, porcentajeGeneral, tareasPendientes };
  }

  private construirMensaje(resumen: ResumenIncentivo, comentario?: string): string {
    const lineas = resumen.renglones
      .map((r) => `🔹 *${r.nombre}:* ${r.porcentaje.toFixed(2)}% ($${formatoMonto(r.montoGanado)} de $${formatoMonto(r.peso)})`)
      .join('\n');
    const pendientes =
      resumen.tareasPendientes.length > 0
        ? resumen.tareasPendientes.map((t) => `• ${t.titulo}${t.categoriaNombre ? ` (${t.categoriaNombre})` : ''}`).join('\n')
        : 'Ninguna — todas las tareas del período están completadas. 🎉';

    const partes = [
      '📊 *REPORTE DE CUMPLIMIENTO DE INCENTIVO IT*',
      `🗓 *Período:* ${resumen.periodo}`,
      '',
      '*Resumen de Renglones:*',
      lineas,
      '',
      '*Tareas pendientes del período:*',
      pendientes,
      '',
      '-----------------------------------',
      `🎯 *Cumplimiento General:* ${resumen.porcentajeGeneral.toFixed(2)}%`,
      `💰 *Total Incentivo Ganado:* $${formatoMonto(resumen.montoGanadoTotal)} / $${formatoMonto(resumen.pesoTotal)}`,
      '-----------------------------------',
    ];
    if (comentario?.trim()) {
      partes.push('', `💬 *Comentario:* ${comentario.trim()}`);
    }
    partes.push('_Enviado automáticamente desde el Sistema de Gestión IT_');
    return partes.join('\n');
  }

  /**
   * El análisis de IA (botón "Analizar con IA" en el modal de envío) solo
   * tiene efecto acá con `canal === 'EMAIL'` — decisión explícita del
   * usuario ("ese análisis solo enviarlo por correo"), WhatsApp sigue con
   * el texto plano de siempre sin importar si `analisisIa` viene cargado.
   */
  async enviarResumen(mes: string, canal: 'EMAIL' | 'WHATSAPP', destino: string, tenantId: string, comentario?: string, analisisIa?: string) {
    const resumen = await this.resumen(mes);
    const asunto = `Reporte de cumplimiento de incentivo IT — ${resumen.periodo}`;

    const enviado =
      canal === 'EMAIL'
        ? await this.emailChannel.enviar(destino, asunto, construirEmailIncentivoHtml(resumen, { comentario, analisisIa }), undefined, tenantId)
        : await this.whatsAppChannel.enviar(destino, asunto, this.construirMensaje(resumen, comentario), tenantId);

    if (!enviado) {
      throw new ServiceUnavailableException(
        canal === 'EMAIL'
          ? 'No se pudo enviar el email — revisá la configuración SMTP en Plataforma.'
          : 'No se pudo enviar el WhatsApp — revisá la configuración de Twilio en Plataforma.',
      );
    }
    return { enviado: true };
  }

  private construirPromptAnalisis(resumen: ResumenIncentivo): string {
    const lineas = resumen.renglones.map((r) => `- ${r.nombre}: ${r.porcentaje.toFixed(2)}% ($${formatoMonto(r.montoGanado)} de $${formatoMonto(r.peso)})`).join('\n');
    const pendientes =
      resumen.tareasPendientes.length > 0 ? resumen.tareasPendientes.map((t) => `- ${t.titulo}${t.categoriaNombre ? ` (${t.categoriaNombre})` : ''}`).join('\n') : '(ninguna)';

    return [
      'Sos un analista interno que resume, para gerencia, el cumplimiento mensual de un plan de incentivo de un equipo de IT.',
      'Escribí un análisis breve (3 a 5 líneas, sin encabezados ni markdown) en español, tono profesional y directo.',
      'Basate ÚNICAMENTE en los datos de abajo — nunca inventes cifras, nombres o tareas que no estén ahí.',
      'Señalá qué renglón(es) van peor y cuáles mejor, si hay un patrón en las tareas pendientes, y una sugerencia concreta de a qué prestarle atención el resto del mes.',
      '',
      `Período: ${resumen.periodo}`,
      `Cumplimiento general: ${resumen.porcentajeGeneral.toFixed(2)}%`,
      `Incentivo ganado: $${formatoMonto(resumen.montoGanadoTotal)} de $${formatoMonto(resumen.pesoTotal)}`,
      '',
      'Renglones:',
      lineas,
      '',
      'Tareas pendientes del período:',
      pendientes,
    ].join('\n');
  }

  /**
   * Botón "Analizar con IA" del modal de envío — resuelve la IA en dos
   * pasos, mismo criterio de "propio del tenant con fallback a
   * Plataforma" que WhatsAppChannel/EmailChannel: primero la IA que el
   * tenant ya configuró para su bot de WhatsApp (Integraciones), y si no
   * tiene una cargada, cae al Asistente general de la app (gastando cupo
   * mensual de `UsoIaTenant`/ASISTENTE — mismo tope que ya usan
   * "Sugerir cuenta contable"/las descripciones generadas). Corre dentro
   * de un request autenticado normal (`CategoriasIncentivoController`),
   * así que `UsoIaService` (vía `TenantPrismaService`) es seguro de usar
   * acá — a diferencia del webhook de WhatsApp, que nunca debe tocarlo.
   */
  async analizarConIa(mes: string, tenantId: string): Promise<{ analisis: string }> {
    const resumen = await this.resumen(mes);
    if (resumen.renglones.length === 0) {
      throw new BadRequestException('No hay categorías de incentivo activas para analizar.');
    }
    const prompt = this.construirPromptAnalisis(resumen);

    const configTenant = await this.prisma.whatsappConfigTenant.findUnique({ where: { tenantId } });
    let texto: string | null = null;

    if (configTenant?.iaApiKeyCifrado) {
      texto = await this.conversacionIaService.completar(configTenant.iaProveedor, [{ role: 'user', content: prompt }], {
        apiKey: descifrar(configTenant.iaApiKeyCifrado),
        modelo: configTenant.iaModelo ?? undefined,
        maxTokens: 400,
      });
    }

    if (!texto) {
      const permitido = await this.usoIaService.intentarRegistrar(tenantId, 'ASISTENTE');
      if (permitido) {
        texto = await this.iaClientService.completar(prompt, 400);
      }
    }

    if (!texto) {
      throw new ServiceUnavailableException(
        'No se pudo generar el análisis — no hay una IA configurada (ni el bot de WhatsApp ni el Asistente general) o se alcanzó el límite mensual del Asistente.',
      );
    }
    return { analisis: texto.trim() };
  }
}
