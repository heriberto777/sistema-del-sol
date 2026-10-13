import { Injectable } from '@nestjs/common';
import { ClienteTimelineRepository } from './cliente-timeline.repository';
import { ClientesService } from '../clientes/clientes.service';
import { LealtadService } from '../lealtad/lealtad.service';
import { WhatsappMensajesAdminRepository } from '../whatsapp-bot/whatsapp-mensajes-admin.repository';

type TipoEntradaTimeline = 'whatsapp' | 'lealtad' | 'cotizacion' | 'factura';

interface EntradaTimeline {
  tipo: TipoEntradaTimeline;
  fecha: Date;
  resumen: string;
  meta?: Record<string, unknown>;
}

const TOPE_ENTRADAS = 100;
const TOPE_MENSAJES_POR_TELEFONO = 30;

/**
 * Ficha 360° (Fase 2) — mezcla 4 fuentes que hoy viven separadas:
 * WhatsApp, Lealtad, Cotizaciones, Facturas. El cruce con WhatsApp es por
 * `Cliente.telefono`/`telefonoSecundario` contra `WhatsappMensaje.telefono`
 * — NO hay FK entre esos dos modelos (hallazgo del diseño original), así
 * que un teléfono mal cargado o un mensaje desde otro número simplemente
 * no aparece acá. Limitación conocida, no silenciosa.
 */
@Injectable()
export class ClienteTimelineService {
  constructor(
    private readonly clienteTimelineRepository: ClienteTimelineRepository,
    private readonly clientesService: ClientesService,
    private readonly lealtadService: LealtadService,
    private readonly whatsappMensajesAdminRepository: WhatsappMensajesAdminRepository,
  ) {}

  async obtener(clienteId: string) {
    const cliente = await this.clientesService.buscarPorId(clienteId);
    const telefonos = [cliente.telefono, cliente.telefonoSecundario].filter((t): t is string => !!t);

    const [mensajesPorTelefono, movimientosLealtad, cotizaciones, facturas] = await Promise.all([
      Promise.all(telefonos.map((telefono) => this.whatsappMensajesAdminRepository.obtenerConversacion(telefono))),
      this.lealtadService.historialCliente(clienteId),
      this.clienteTimelineRepository.cotizacionesRecientes(clienteId),
      this.clienteTimelineRepository.facturasRecientes(clienteId),
    ]);

    // `obtenerConversacion` no tiene tope (la bandeja de chat necesita el
    // historial completo) — acá solo nos interesan los últimos mensajes
    // por teléfono, no revivir la conversación entera.
    const mensajes = mensajesPorTelefono.flatMap((hilo) => hilo.slice(-TOPE_MENSAJES_POR_TELEFONO));

    const entradas: EntradaTimeline[] = [
      ...mensajes.map((m) => ({
        tipo: 'whatsapp' as const,
        fecha: m.createdAt,
        resumen: m.contenido,
        meta: { rol: m.rol, telefono: m.telefono },
      })),
      ...movimientosLealtad.map((m) => ({
        tipo: 'lealtad' as const,
        fecha: m.createdAt,
        resumen: `${m.tipo} — ${m.puntos > 0 ? '+' : ''}${m.puntos} puntos${m.motivo ? ` (${m.motivo})` : ''}`,
      })),
      ...cotizaciones.map((c) => ({
        tipo: 'cotizacion' as const,
        fecha: c.createdAt,
        resumen: `Cotización ${c.numero} — ${c.estado} — RD$ ${Number(c.total).toLocaleString('es-DO')}`,
        meta: { id: c.id },
      })),
      ...facturas.map((f) => ({
        tipo: 'factura' as const,
        fecha: f.createdAt,
        resumen: `Factura ${f.numero} — ${f.estado} — RD$ ${Number(f.total).toLocaleString('es-DO')}`,
        meta: { id: f.id },
      })),
    ];

    return entradas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, TOPE_ENTRADAS);
  }
}
