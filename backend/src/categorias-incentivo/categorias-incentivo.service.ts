import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CategoriasIncentivoRepository } from './categorias-incentivo.repository';
import { CrearCategoriaIncentivoDto } from './dto/crear-categoria-incentivo.dto';
import { ActualizarCategoriaIncentivoDto } from './dto/actualizar-categoria-incentivo.dto';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { WhatsAppChannel } from '../notificaciones/canales/whatsapp.channel';

export interface RenglonResumenIncentivo {
  id: string;
  nombre: string;
  peso: number;
  tareasTotales: number;
  tareasCompletadas: number;
  porcentaje: number;
  montoGanado: number;
}

export interface ResumenIncentivo {
  periodo: string;
  renglones: RenglonResumenIncentivo[];
  pesoTotal: number;
  montoGanadoTotal: number;
  porcentajeGeneral: number;
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
  ) {}

  crear(dto: CrearCategoriaIncentivoDto, tenantId: string) {
    return this.repository.crear(dto, tenantId);
  }

  listar() {
    return this.repository.listar();
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
    const datos = await this.repository.resumenPeriodo(desde, hasta);

    const renglones: RenglonResumenIncentivo[] = datos.map(({ categoria, tareasTotales, tareasCompletadas }) => {
      const porcentaje = tareasTotales > 0 ? (tareasCompletadas / tareasTotales) * 100 : 0;
      const peso = Number(categoria.peso);
      return { id: categoria.id, nombre: categoria.nombre, peso, tareasTotales, tareasCompletadas, porcentaje, montoGanado: peso * (porcentaje / 100) };
    });

    const pesoTotal = renglones.reduce((acc, r) => acc + r.peso, 0);
    const montoGanadoTotal = renglones.reduce((acc, r) => acc + r.montoGanado, 0);
    const porcentajeGeneral = pesoTotal > 0 ? (montoGanadoTotal / pesoTotal) * 100 : 0;

    return { periodo: etiqueta, renglones, pesoTotal, montoGanadoTotal, porcentajeGeneral };
  }

  private construirMensaje(resumen: ResumenIncentivo): string {
    const lineas = resumen.renglones
      .map((r) => `🔹 *${r.nombre}:* ${r.porcentaje.toFixed(2)}% ($${formatoMonto(r.montoGanado)} de $${formatoMonto(r.peso)})`)
      .join('\n');

    return [
      '📊 *REPORTE DE CUMPLIMIENTO DE INCENTIVO IT*',
      `🗓 *Período:* ${resumen.periodo}`,
      '',
      '*Resumen de Renglones:*',
      lineas,
      '',
      '-----------------------------------',
      `🎯 *Cumplimiento General:* ${resumen.porcentajeGeneral.toFixed(2)}%`,
      `💰 *Total Incentivo Ganado:* $${formatoMonto(resumen.montoGanadoTotal)} / $${formatoMonto(resumen.pesoTotal)}`,
      '-----------------------------------',
      '_Enviado automáticamente desde el Sistema de Gestión IT_',
    ].join('\n');
  }

  async enviarResumen(mes: string, canal: 'EMAIL' | 'WHATSAPP', destino: string) {
    const resumen = await this.resumen(mes);
    const mensaje = this.construirMensaje(resumen);
    const asunto = `Reporte de cumplimiento de incentivo IT — ${resumen.periodo}`;

    const enviado =
      canal === 'EMAIL'
        ? await this.emailChannel.enviar(destino, asunto, `<pre style="font-family:monospace;white-space:pre-wrap">${mensaje}</pre>`)
        : await this.whatsAppChannel.enviar(destino, asunto, mensaje);

    if (!enviado) {
      throw new ServiceUnavailableException(
        canal === 'EMAIL'
          ? 'No se pudo enviar el email — revisá la configuración SMTP en Plataforma.'
          : 'No se pudo enviar el WhatsApp — revisá la configuración de Twilio en Plataforma.',
      );
    }
    return { enviado: true };
  }
}
